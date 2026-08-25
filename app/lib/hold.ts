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

export const HOLD_HOUR_PRESETS = [12, 24, 48, 72, 168, 336, 720] as const;
export const MIN_HOLD_HOURS = 1;
export const MAX_HOLD_HOURS = 8760;

export function parseHoldHours(value: unknown): number {
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < MIN_HOLD_HOURS || hours > MAX_HOLD_HOURS) {
    return 72;
  }
  return hours;
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseExpiryDateTime(
  dateValue: unknown,
  timeValue: unknown,
  now: Date = new Date(),
): { ok: true; expiresAt: Date } | { ok: false; message: string } {
  const date = String(dateValue ?? "").trim();
  const time = String(timeValue ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: "Choose an expiry date" };
  }
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return { ok: false, message: "Choose an expiry time" };
  }
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) {
    return { ok: false, message: "Choose a valid time" };
  }

  const [year, month, day] = date.split("-").map(Number);
  const expiresAt = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(expiresAt.getTime())) {
    return { ok: false, message: "Choose a valid date and time" };
  }
  if (expiresAt.getTime() <= now.getTime() + 60_000) {
    return { ok: false, message: "Expiry must be in the future" };
  }
  const max = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  if (expiresAt.getTime() > max.getTime()) {
    return { ok: false, message: "Expiry cannot be more than 1 year away" };
  }
  return { ok: true, expiresAt };
}

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
