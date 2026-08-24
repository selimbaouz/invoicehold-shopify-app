export const HOLD_TRIGGERS = ["invoice_sent", "draft_created"] as const;
export type HoldTrigger = (typeof HOLD_TRIGGERS)[number];

export const HOLD_STATUSES = [
  "active",
  "paid",
  "expired",
  "released",
  "error",
] as const;
export type HoldStatus = (typeof HOLD_STATUSES)[number];

export const HOLD_HOUR_OPTIONS = [24, 72, 168] as const;
export type HoldHours = (typeof HOLD_HOUR_OPTIONS)[number];

export type DraftReservePayload = {
  status?: string | null;
  invoice_sent_at?: string | null;
  invoiceSentAt?: string | null;
};

export type ExistingHold = {
  status: HoldStatus;
};

export type IncomingHoldEvent = {
  kind: "reserve" | "paid" | "deleted";
};

export type HoldIdempotentDecision = "skip" | "create" | "update";

export function computeExpiry(from: Date, holdHours: number): Date {
  return new Date(from.getTime() + holdHours * 60 * 60 * 1000);
}

/**
 * Invoice-send detection uses REST webhook fields on draft_orders/create and
 * draft_orders/update:
 * - `status === "invoice_sent"` (Shopify REST draft order status)
 * - `invoice_sent_at` is a non-empty timestamp
 *
 * `invoice_url` exists on every draft (checkout link) so it is NOT a send signal.
 */
export function shouldReserve(
  trigger: HoldTrigger,
  draftPayload: DraftReservePayload,
): boolean {
  const status = normalizeDraftStatus(draftPayload.status);
  if (status === "completed") return false;

  if (trigger === "draft_created") {
    return true;
  }

  const invoiceSentAt =
    draftPayload.invoice_sent_at ?? draftPayload.invoiceSentAt ?? null;
  return status === "invoice_sent" || hasTimestamp(invoiceSentAt);
}

export function isHoldIdempotent(
  existingHold: ExistingHold | null,
  incomingEvent: IncomingHoldEvent,
): HoldIdempotentDecision {
  if (!existingHold) {
    return incomingEvent.kind === "reserve" ? "create" : "skip";
  }

  if (incomingEvent.kind === "reserve") {
    if (existingHold.status === "active" || existingHold.status === "paid") {
      return "skip";
    }
    return "update";
  }

  if (incomingEvent.kind === "paid") {
    return existingHold.status === "paid" ? "skip" : "update";
  }

  if (
    existingHold.status === "released" ||
    existingHold.status === "paid"
  ) {
    return "skip";
  }
  return "update";
}

function normalizeDraftStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function hasTimestamp(value: string | null | undefined): boolean {
  if (value == null) return false;
  return String(value).trim().length > 0;
}
