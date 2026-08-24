import type { ActionFunctionArgs } from "react-router";
import { redactShopData } from "../lib/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  await redactShopData(shop);
  console.log(`[InvoiceHold] ${topic} wiped shop data for ${shop}`);

  return new Response();
};
