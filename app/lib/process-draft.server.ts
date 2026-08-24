import { Prisma, type Hold, type HoldStatus } from "@prisma/client";
import prisma from "../db.server";
import {
  applyReserveInventoryUntil,
  type GraphqlClient,
} from "./draft-orders.server";
import {
  parseDraftWebhookPayload,
  serializeLineItems,
  type HoldLineItemSnapshot,
} from "./draft-payload";
import { computeExpiry, isHoldIdempotent, shouldReserve } from "./hold";
import { getOrCreateShopSetting } from "./settings.server";
import { writeSyncLog } from "./sync-log.server";

async function claimProcessedEvent(
  shop: string,
  eventId: string,
): Promise<boolean> {
  try {
    await prisma.processedEvent.create({
      data: { shop, eventId },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

async function releaseProcessedEvent(shop: string, eventId: string) {
  await prisma.processedEvent.deleteMany({
    where: { shop, eventId },
  });
}

function isCompletedStatus(status: string | null): boolean {
  return String(status ?? "").trim().toLowerCase() === "completed";
}

async function upsertHold(options: {
  shop: string;
  draftOrderId: string;
  draftOrderName: string | null;
  invoiceEmail: string | null;
  quantitySummary: number;
  lineItems: HoldLineItemSnapshot[];
  reservedAt: Date;
  expiresAt: Date;
  status: HoldStatus;
  errorMessage: string | null;
}): Promise<Hold> {
  return prisma.hold.upsert({
    where: {
      shop_draftOrderId: {
        shop: options.shop,
        draftOrderId: options.draftOrderId,
      },
    },
    create: {
      shop: options.shop,
      draftOrderId: options.draftOrderId,
      draftOrderName: options.draftOrderName,
      invoiceEmail: options.invoiceEmail,
      quantitySummary: options.quantitySummary,
      lineItemsJson: serializeLineItems(options.lineItems),
      reservedAt: options.reservedAt,
      expiresAt: options.expiresAt,
      status: options.status,
      errorMessage: options.errorMessage,
    },
    update: {
      draftOrderName: options.draftOrderName,
      invoiceEmail: options.invoiceEmail,
      quantitySummary: options.quantitySummary,
      lineItemsJson: serializeLineItems(options.lineItems),
      reservedAt: options.reservedAt,
      expiresAt: options.expiresAt,
      status: options.status,
      errorMessage: options.errorMessage,
    },
  });
}

export async function processDraftOrderWebhook(options: {
  shop: string;
  webhookId: string;
  payload: Record<string, unknown>;
  admin?: GraphqlClient;
}): Promise<void> {
  const { shop, webhookId, payload, admin } = options;
  const parsed = parseDraftWebhookPayload(payload);
  if (!parsed.draftOrderId) {
    console.error(`[InvoiceHold] ${shop}: draft webhook missing id`);
    return;
  }

  const claimed = await claimProcessedEvent(shop, webhookId);
  if (!claimed) {
    console.log(
      `[InvoiceHold] ${shop}: webhook ${webhookId} already processed`,
    );
    return;
  }

  try {
    const existing = await prisma.hold.findUnique({
      where: {
        shop_draftOrderId: {
          shop,
          draftOrderId: parsed.draftOrderId,
        },
      },
    });

    if (isCompletedStatus(parsed.status)) {
      const decision = isHoldIdempotent(existing, { kind: "paid" });
      if (decision === "skip") {
        await writeSyncLog({
          shop,
          draftOrderId: parsed.draftOrderId,
          action: "skip",
          success: true,
          message: "Draft already marked paid",
        });
        return;
      }

      if (existing) {
        await prisma.hold.update({
          where: { id: existing.id },
          data: {
            status: "paid",
            errorMessage: null,
            draftOrderName: parsed.draftOrderName ?? existing.draftOrderName,
            invoiceEmail: parsed.invoiceEmail ?? existing.invoiceEmail,
          },
        });
      }
      await writeSyncLog({
        shop,
        draftOrderId: parsed.draftOrderId,
        action: "paid",
        success: true,
        message: "Draft completed; Shopify now holds stock as an order",
      });
      return;
    }

    const settings = await getOrCreateShopSetting(shop);
    const matchesTrigger = shouldReserve(settings.trigger, {
      status: parsed.status,
      invoice_sent_at: parsed.invoiceSentAt,
    });
    if (!settings.enabled || !matchesTrigger) {
      return;
    }

    const decision = isHoldIdempotent(existing, { kind: "reserve" });
    if (decision === "skip") {
      await writeSyncLog({
        shop,
        draftOrderId: parsed.draftOrderId,
        action: "skip",
        success: true,
        message: "Hold already active; webhook replay ignored",
      });
      return;
    }

    const now = new Date();
    const expiresAt = computeExpiry(now, settings.holdHours);

    if (!admin) {
      const message = "No admin session; could not call draftOrderUpdate";
      await upsertHold({
        shop,
        draftOrderId: parsed.draftOrderId,
        draftOrderName: parsed.draftOrderName,
        invoiceEmail: parsed.invoiceEmail,
        quantitySummary: parsed.quantitySummary,
        lineItems: parsed.lineItems,
        reservedAt: now,
        expiresAt,
        status: "error",
        errorMessage: message,
      });
      await writeSyncLog({
        shop,
        draftOrderId: parsed.draftOrderId,
        action: "reserve",
        success: false,
        message,
      });
      return;
    }

    const result = await applyReserveInventoryUntil(
      admin,
      parsed.draftOrderId,
      expiresAt,
    );
    if (!result.ok) {
      await upsertHold({
        shop,
        draftOrderId: parsed.draftOrderId,
        draftOrderName: parsed.draftOrderName,
        invoiceEmail: parsed.invoiceEmail,
        quantitySummary: parsed.quantitySummary,
        lineItems: parsed.lineItems,
        reservedAt: now,
        expiresAt,
        status: "error",
        errorMessage: result.message,
      });
      await writeSyncLog({
        shop,
        draftOrderId: parsed.draftOrderId,
        action: "reserve",
        success: false,
        message: result.message,
      });
      return;
    }

    await upsertHold({
      shop,
      draftOrderId: parsed.draftOrderId,
      draftOrderName: result.draftOrder.name ?? parsed.draftOrderName,
      invoiceEmail: result.draftOrder.email ?? parsed.invoiceEmail,
      quantitySummary: parsed.quantitySummary,
      lineItems: parsed.lineItems,
      reservedAt: now,
      expiresAt,
      status: "active",
      errorMessage: null,
    });
    await writeSyncLog({
      shop,
      draftOrderId: parsed.draftOrderId,
      action: "reserve",
      success: true,
      message: `Reserved until ${expiresAt.toISOString()} (${settings.holdHours}h)`,
    });
  } catch (error) {
    await releaseProcessedEvent(shop, webhookId);
    const message = error instanceof Error ? error.message : String(error);
    await writeSyncLog({
      shop,
      draftOrderId: parsed.draftOrderId,
      action: "reserve",
      success: false,
      message,
    });
    throw error;
  }
}

export async function processDraftOrderDelete(options: {
  shop: string;
  webhookId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { shop, webhookId, payload } = options;
  const parsed = parseDraftWebhookPayload(payload);
  if (!parsed.draftOrderId) return;

  const claimed = await claimProcessedEvent(shop, webhookId);
  if (!claimed) return;

  try {
    const existing = await prisma.hold.findUnique({
      where: {
        shop_draftOrderId: {
          shop,
          draftOrderId: parsed.draftOrderId,
        },
      },
    });
    const decision = isHoldIdempotent(existing, { kind: "deleted" });
    if (decision === "skip") {
      await writeSyncLog({
        shop,
        draftOrderId: parsed.draftOrderId,
        action: "skip",
        success: true,
        message: "Delete ignored; hold already paid or released",
      });
      return;
    }

    if (existing) {
      await prisma.hold.update({
        where: { id: existing.id },
        data: { status: "released", errorMessage: null },
      });
    }
    await writeSyncLog({
      shop,
      draftOrderId: parsed.draftOrderId,
      action: "release",
      success: true,
      message: "Draft deleted; Shopify released the reservation",
    });
  } catch (error) {
    await releaseProcessedEvent(shop, webhookId);
    throw error;
  }
}

export async function markExpiredHolds(shop: string): Promise<number> {
  const result = await prisma.hold.updateMany({
    where: {
      shop,
      status: "active",
      expiresAt: { lte: new Date() },
    },
    data: { status: "expired", errorMessage: null },
  });
  return result.count;
}

export async function releaseHoldNow(options: {
  admin: GraphqlClient;
  shop: string;
  holdId: string;
}): Promise<{ ok: boolean; message: string }> {
  const hold = await prisma.hold.findFirst({
    where: { id: options.holdId, shop: options.shop },
  });
  if (!hold) {
    return { ok: false, message: "Hold not found" };
  }
  if (hold.status !== "active" && hold.status !== "error") {
    return { ok: false, message: `Cannot release a ${hold.status} hold` };
  }

  const result = await applyReserveInventoryUntil(
    options.admin,
    hold.draftOrderId,
    null,
  );
  if (!result.ok) {
    await prisma.hold.update({
      where: { id: hold.id },
      data: { status: "error", errorMessage: result.message },
    });
    await writeSyncLog({
      shop: options.shop,
      draftOrderId: hold.draftOrderId,
      action: "release",
      success: false,
      message: result.message,
    });
    return { ok: false, message: result.message };
  }

  await prisma.hold.update({
    where: { id: hold.id },
    data: { status: "released", errorMessage: null },
  });
  await writeSyncLog({
    shop: options.shop,
    draftOrderId: hold.draftOrderId,
    action: "release",
    success: true,
    message: "Merchant released the reservation",
  });
  return { ok: true, message: "Reservation released" };
}
