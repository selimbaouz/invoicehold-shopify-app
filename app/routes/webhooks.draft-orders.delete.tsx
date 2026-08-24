import type { ActionFunctionArgs } from "react-router";
import { processDraftOrderDelete } from "../lib/process-draft.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, webhookId, payload } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await processDraftOrderDelete({
      shop,
      webhookId,
      payload: payload as Record<string, unknown>,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[InvoiceHold] ${topic} failed for ${shop}: ${message}`);
  }

  return new Response();
};
