import type { HoldStatus } from "./hold";

export function formatExpiresIn(expiresAt: Date, now: Date): string {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
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
