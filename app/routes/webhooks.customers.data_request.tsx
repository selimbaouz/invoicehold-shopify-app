import type { ActionFunctionArgs } from "react-router";
import { parseCustomerDataRequestPayload } from "../lib/compliance";
import { findHoldsByEmail } from "../lib/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const parsed = parseCustomerDataRequestPayload(
    payload as Record<string, unknown>,
  );
  const storedDraftIds = parsed.email
    ? await findHoldsByEmail(shop, parsed.email)
    : [];

  console.log(
    `[InvoiceHold] ${topic} for ${shop} request=${parsed.dataRequestId ?? "unknown"} storedDrafts=${storedDraftIds.length}`,
  );

  return new Response();
};
