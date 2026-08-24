import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { deserializeLineItems } from "../lib/draft-payload";
import { fetchDraftOrder } from "../lib/draft-orders.server";
import {
  formatExpiresIn,
  holdStatusLabel,
  holdStatusTone,
} from "../lib/hold-display";
import { markExpiredHolds, releaseHoldNow } from "../lib/process-draft.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const holdId = String(params.holdId ?? "").trim();
  await markExpiredHolds(session.shop);

  const hold = await prisma.hold.findFirst({
    where: { id: holdId, shop: session.shop },
  });
  if (!hold) {
    throw new Response("Hold not found", { status: 404 });
  }

  const logs = await prisma.syncLog.findMany({
    where: { shop: session.shop, draftOrderId: hold.draftOrderId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  let liveLineItems: Array<{
    title: string;
    quantity: number;
    sku: string | null;
    variantTitle: string | null;
  }> | null = null;
  let liveReserveUntil: string | null = null;
  let graphqlError: string | null = null;

  try {
    const live = await fetchDraftOrder(admin, hold.draftOrderId);
    if (live) {
      liveLineItems = live.lineItems;
      liveReserveUntil = live.reserveInventoryUntil;
    }
  } catch (error) {
    graphqlError =
      error instanceof Error ? error.message : "Could not load draft from Shopify";
  }

  return {
    hold: {
      id: hold.id,
      draftOrderId: hold.draftOrderId,
      draftOrderName: hold.draftOrderName,
      invoiceEmail: hold.invoiceEmail,
      quantitySummary: hold.quantitySummary,
      reservedAt: hold.reservedAt.toISOString(),
      expiresAt: hold.expiresAt.toISOString(),
      status: hold.status,
      errorMessage: hold.errorMessage,
      lineItems: deserializeLineItems(hold.lineItemsJson),
    },
    liveLineItems,
    liveReserveUntil,
    graphqlError,
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      success: log.success,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  if (formData.get("intent") !== "release") {
    return { ok: false, message: "Unknown action" };
  }

  const holdId = String(params.holdId ?? "").trim();
  return releaseHoldNow({ admin, shop: session.shop, holdId });
};

export default function HoldDetail() {
  const { hold, liveLineItems, liveReserveUntil, graphqlError, logs } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const now = new Date();
  const lineItems = liveLineItems ?? hold.lineItems;
  const canRelease = hold.status === "active" || hold.status === "error";
  const isReleasing = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      shopify.toast.show(
        fetcher.data.ok ? "Reservation released" : fetcher.data.message,
      );
    }
  }, [fetcher.data, fetcher.state, shopify]);

  return (
    <s-page heading={hold.draftOrderName || "Hold"}>
      <s-link slot="breadcrumb-actions" href="/app">
        Holds
      </s-link>
      <s-button
        slot="secondary-actions"
        loading={revalidator.state === "loading" || undefined}
        onClick={() => revalidator.revalidate()}
      >
        Refresh
      </s-button>
      {canRelease ? (
        <s-button
          slot="primary-action"
          tone="critical"
          loading={isReleasing || undefined}
          onClick={() => {
            const data = new FormData();
            data.set("intent", "release");
            fetcher.submit(data, { method: "POST" });
          }}
        >
          Release now
        </s-button>
      ) : null}

      {hold.status === "error" && hold.errorMessage ? (
        <s-banner tone="critical" heading="Hold failed">
          {hold.errorMessage}
        </s-banner>
      ) : null}
      {graphqlError ? (
        <s-banner tone="warning" heading="Couldn’t refresh this draft from Shopify">
          {graphqlError} Showing the snapshot from when the hold was created.
          Click Refresh to try again.
        </s-banner>
      ) : null}

      <s-section heading="Status">
        <s-stack gap="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-badge tone={holdStatusTone(hold.status)}>
              {holdStatusLabel(hold.status)}
            </s-badge>
            {hold.status === "active" ? (
              <s-text>
                Expires in {formatExpiresIn(new Date(hold.expiresAt), now)}
              </s-text>
            ) : null}
          </s-stack>
          <s-paragraph>
            Customer: {hold.invoiceEmail || "No email on this draft"}
          </s-paragraph>
          <s-paragraph>
            Reserved at {new Date(hold.reservedAt).toLocaleString()}
          </s-paragraph>
          <s-paragraph>
            Expires at {new Date(hold.expiresAt).toLocaleString()}
          </s-paragraph>
          {liveReserveUntil ? (
            <s-paragraph>
              Shopify reserveInventoryUntil:{" "}
              {new Date(liveReserveUntil).toLocaleString()}
            </s-paragraph>
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading="Line items">
        {lineItems.length === 0 ? (
          <s-paragraph>No line items stored for this hold.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Item</s-table-header>
              <s-table-header listSlot="labeled">Qty</s-table-header>
              <s-table-header listSlot="labeled">SKU</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {lineItems.map((item, index) => (
                <s-table-row key={`${item.title}-${index}`}>
                  <s-table-cell>
                    {"variantTitle" in item && item.variantTitle
                      ? `${item.title} — ${item.variantTitle}`
                      : item.title}
                  </s-table-cell>
                  <s-table-cell>{item.quantity}</s-table-cell>
                  <s-table-cell>{item.sku || "—"}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section heading="Log">
        {logs.length === 0 ? (
          <s-paragraph>No events logged yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Time</s-table-header>
              <s-table-header listSlot="labeled">Action</s-table-header>
              <s-table-header listSlot="labeled">Result</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {logs.map((log) => (
                <s-table-row key={log.id}>
                  <s-table-cell>
                    {new Date(log.createdAt).toLocaleString()}
                  </s-table-cell>
                  <s-table-cell>{log.action}</s-table-cell>
                  <s-table-cell>
                    {log.success ? "OK" : "Error"}
                    {log.message ? ` — ${log.message}` : ""}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
