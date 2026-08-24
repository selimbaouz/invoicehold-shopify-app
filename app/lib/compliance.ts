export function parseShopRedactPayload(
  payload: Record<string, unknown>,
): { shopDomain: string | null } {
  const shopDomain =
    payload.shop_domain == null ? null : String(payload.shop_domain).trim();
  return { shopDomain: shopDomain || null };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function parseCustomerRedactPayload(
  payload: Record<string, unknown>,
): { shopDomain: string | null; email: string | null } {
  const { shopDomain } = parseShopRedactPayload(payload);
  const customer = asRecord(payload.customer);
  const email =
    customer?.email == null ? null : String(customer.email).trim();
  return { shopDomain, email: email || null };
}

export function parseCustomerDataRequestPayload(
  payload: Record<string, unknown>,
): {
  shopDomain: string | null;
  dataRequestId: string | null;
  email: string | null;
} {
  const { shopDomain, email } = parseCustomerRedactPayload(payload);
  const dataRequest = asRecord(payload.data_request);
  const dataRequestId =
    dataRequest?.id == null ? null : String(dataRequest.id).trim();
  return {
    shopDomain,
    dataRequestId: dataRequestId || null,
    email,
  };
}
