import type { ShopSetting } from "@prisma/client";
import prisma from "../db.server";
import {
  HOLD_HOUR_OPTIONS,
  HOLD_TRIGGERS,
  type HoldHours,
  type HoldTrigger,
} from "./hold";

export async function getOrCreateShopSetting(
  shop: string,
): Promise<ShopSetting> {
  return prisma.shopSetting.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

export async function updateShopSetting(
  shop: string,
  data: {
    enabled: boolean;
    holdHours: HoldHours;
    trigger: HoldTrigger;
  },
): Promise<ShopSetting> {
  return prisma.shopSetting.upsert({
    where: { shop },
    create: {
      shop,
      enabled: data.enabled,
      holdHours: data.holdHours,
      trigger: data.trigger,
    },
    update: {
      enabled: data.enabled,
      holdHours: data.holdHours,
      trigger: data.trigger,
    },
  });
}

export function parseHoldHours(value: unknown): HoldHours {
  const hours = Number(value);
  if ((HOLD_HOUR_OPTIONS as readonly number[]).includes(hours)) {
    return hours as HoldHours;
  }
  return 72;
}

export function parseHoldTrigger(value: unknown): HoldTrigger {
  const trigger = String(value ?? "");
  if ((HOLD_TRIGGERS as readonly string[]).includes(trigger)) {
    return trigger as HoldTrigger;
  }
  return "invoice_sent";
}
