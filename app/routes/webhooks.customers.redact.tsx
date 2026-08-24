import type { ActionFunctionArgs } from "react-router";
import { parseCustomerRedactPayload } from "../lib/compliance";
import { redactCustomerEmail } from "../lib/compliance.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const parsed = parseCustomerRedactPayload(
    payload as Record<string, unknown>,
  );
  const deleted = parsed.email
    ? await redactCustomerEmail(shop, parsed.email)
    : 0;

  console.log(
    `[InvoiceHold] ${topic} for ${shop} redactedEmails=${deleted}`,
  );

  return new Response();
};
