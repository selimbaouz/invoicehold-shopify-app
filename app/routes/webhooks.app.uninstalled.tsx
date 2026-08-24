import type { ActionFunctionArgs } from "react-router";
import { redactShopData } from "../lib/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  await redactShopData(shop);

  return new Response();
};
