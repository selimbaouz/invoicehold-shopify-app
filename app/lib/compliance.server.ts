import prisma from "../db.server";

export async function redactShopData(shop: string) {
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { shop } }),
    prisma.shopSetting.deleteMany({ where: { shop } }),
    prisma.hold.deleteMany({ where: { shop } }),
    prisma.syncLog.deleteMany({ where: { shop } }),
    prisma.processedEvent.deleteMany({ where: { shop } }),
  ]);
}

export async function redactCustomerEmail(
  shop: string,
  email: string,
): Promise<number> {
  const result = await prisma.hold.updateMany({
    where: { shop, invoiceEmail: email },
    data: { invoiceEmail: null },
  });
  return result.count;
}

export async function findHoldsByEmail(
  shop: string,
  email: string,
): Promise<string[]> {
  const rows = await prisma.hold.findMany({
    where: { shop, invoiceEmail: email },
    select: { draftOrderId: true },
  });
  return rows.map((row) => row.draftOrderId);
}
