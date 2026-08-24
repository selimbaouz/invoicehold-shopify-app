import prisma from "../db.server";

export async function writeSyncLog(options: {
  shop: string;
  draftOrderId: string;
  action: string;
  success: boolean;
  message?: string | null;
}): Promise<void> {
  await prisma.syncLog.create({
    data: {
      shop: options.shop,
      draftOrderId: options.draftOrderId,
      action: options.action,
      success: options.success,
      message: options.message ?? null,
    },
  });
}
