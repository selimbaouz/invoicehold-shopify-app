import type { HoldStatus } from "./hold";
import { toLocalTimeString } from "./hold";

export function formatExpiresIn(expiresAt: Date, now: Date): string {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) {
    const dayPart = days === 1 ? "1 day" : `${days} days`;
    if (hours === 0) return dayPart;
    return `${dayPart} ${hours === 1 ? "1 hour" : `${hours} hours`}`;
  }
  if (hours >= 1) {
    const hourPart = hours === 1 ? "1 hour" : `${hours} hours`;
    if (minutes === 0) return hourPart;
    return `${hourPart} ${minutes === 1 ? "1 minute" : `${minutes} minutes`}`;
  }
  return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
}

export function formatMerchantDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function shopifyExpiryMismatch(
  localExpiresAt: Date,
  shopifyReserveUntil: string | null,
): boolean {
  if (!shopifyReserveUntil) return false;
  const shopifyUntil = new Date(shopifyReserveUntil);
  if (Number.isNaN(shopifyUntil.getTime())) return false;
  return Math.abs(shopifyUntil.getTime() - localExpiresAt.getTime()) > 60_000;
}

export function holdStatusLabel(status: HoldStatus): string {
  switch (status) {
    case "active":
      return "Held";
    case "paid":
      return "Paid";
    case "expired":
      return "Expired";
    case "released":
      return "Released";
    case "error":
      return "Error";
  }
}

export function holdStatusTone(
  status: HoldStatus,
): "success" | "info" | "neutral" | "caution" | "critical" | "warning" {
  switch (status) {
    case "active":
      return "success";
    case "paid":
      return "info";
    case "expired":
      return "neutral";
    case "released":
      return "neutral";
    case "error":
      return "critical";
  }
}

export function holdHoursLabel(hours: number): string {
  switch (hours) {
    case 12:
      return "12 hours";
    case 24:
      return "24 hours";
    case 48:
      return "48 hours";
    case 72:
      return "3 days (72 hours)";
    case 168:
      return "7 days";
    case 336:
      return "14 days";
    case 720:
      return "30 days";
    default:
      return `${hours} hours`;
  }
}

export function expiryTimeOptions(current: Date): string[] {
  const slots = new Set<string>();
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      slots.add(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  slots.add(toLocalTimeString(current));
  return [...slots].sort();
}

export function canChangeHoldExpiry(status: HoldStatus): boolean {
  return status === "active" || status === "error" || status === "expired";
}

export function canReleaseHold(status: HoldStatus): boolean {
  return status === "active" || status === "error";
}

export function shopifyDraftAdminHref(draftOrderId: string): string {
  const id = draftOrderId.split("/").pop() ?? "";
  return id ? `shopify:admin/draft_orders/${id}` : "";
}
