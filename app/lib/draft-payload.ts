import { toDraftOrderGid } from "./shopify-ids";

export type HoldLineItemSnapshot = {
  title: string;
  quantity: number;
  sku: string | null;
};

export type ParsedDraftPayload = {
  draftOrderId: string | null;
  draftOrderName: string | null;
  invoiceEmail: string | null;
  status: string | null;
  invoiceSentAt: string | null;
  lineItems: HoldLineItemSnapshot[];
  quantitySummary: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function unwrapDraftPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const nested = asRecord(payload.draft_order);
  return nested ?? payload;
}

export function parseDraftWebhookPayload(
  payload: Record<string, unknown>,
): ParsedDraftPayload {
  const draft = unwrapDraftPayload(payload);
  const graphqlId =
    draft.admin_graphql_api_id == null
      ? null
      : String(draft.admin_graphql_api_id).trim();
  const rawId = draft.id == null ? null : String(draft.id).trim();
  const draftOrderId =
    graphqlId || (rawId ? toDraftOrderGid(rawId) : null);

  const customer = asRecord(draft.customer);
  const invoiceEmail =
    (draft.email == null ? "" : String(draft.email).trim()) ||
    (customer?.email == null ? "" : String(customer.email).trim()) ||
    null;

  const lineItems = parseLineItems(draft.line_items);
  const quantitySummary = lineItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return {
    draftOrderId,
    draftOrderName:
      draft.name == null ? null : String(draft.name).trim() || null,
    invoiceEmail,
    status: draft.status == null ? null : String(draft.status),
    invoiceSentAt:
      draft.invoice_sent_at == null
        ? null
        : String(draft.invoice_sent_at).trim() || null,
    lineItems,
    quantitySummary,
  };
}

function parseLineItems(value: unknown): HoldLineItemSnapshot[] {
  if (!Array.isArray(value)) return [];
  const items: HoldLineItemSnapshot[] = [];
  for (const entry of value) {
    const item = asRecord(entry);
    if (!item) continue;
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const title =
      (item.name == null ? "" : String(item.name).trim()) ||
      (item.title == null ? "" : String(item.title).trim()) ||
      "Line item";
    items.push({
      title,
      quantity: Math.floor(quantity),
      sku: item.sku == null ? null : String(item.sku).trim() || null,
    });
  }
  return items;
}

export function serializeLineItems(items: HoldLineItemSnapshot[]): string {
  return JSON.stringify(items);
}

export function deserializeLineItems(
  value: string | null | undefined,
): HoldLineItemSnapshot[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const item = asRecord(entry);
      if (!item) return [];
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return [];
      return [
        {
          title:
            item.title == null ? "Line item" : String(item.title) || "Line item",
          quantity: Math.floor(quantity),
          sku: item.sku == null ? null : String(item.sku),
        },
      ];
    });
  } catch {
    return [];
  }
}
