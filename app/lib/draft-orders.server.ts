export type GraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type GraphqlErrorBody = {
  errors?: Array<{ message?: string }>;
};

type DraftOrderUpdateResponse = {
  data?: {
    draftOrderUpdate?: {
      draftOrder?: {
        id?: string | null;
        name?: string | null;
        email?: string | null;
        status?: string | null;
        reserveInventoryUntil?: string | null;
      } | null;
      userErrors?: Array<{ field?: string[] | null; message?: string }>;
    } | null;
  };
} & GraphqlErrorBody;

export type ReserveInventoryResult =
  | {
      ok: true;
      draftOrder: {
        id: string;
        name: string | null;
        email: string | null;
        status: string | null;
        reserveInventoryUntil: string | null;
      };
    }
  | { ok: false; message: string };

const DRAFT_ORDER_RESERVE_MUTATION = `#graphql
  mutation InvoiceHoldReserveInventory($id: ID!, $input: DraftOrderInput!) {
    draftOrderUpdate(id: $id, input: $input) {
      draftOrder {
        id
        name
        email
        status
        reserveInventoryUntil
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Sets Shopify's native draft-order reservation expiry.
 * Passing a Date reserves until that instant.
 * Passing null sets a past timestamp so Shopify releases stock — we do not
 * write a second inventory adjustment.
 */
export async function applyReserveInventoryUntil(
  admin: GraphqlClient,
  draftOrderGid: string,
  until: Date | null,
): Promise<ReserveInventoryResult> {
  const reserveInventoryUntil = (
    until ?? new Date(Date.now() - 1000)
  ).toISOString();

  const response = await admin.graphql(DRAFT_ORDER_RESERVE_MUTATION, {
    variables: {
      id: draftOrderGid,
      input: { reserveInventoryUntil },
    },
  });
  const json = (await response.json()) as DraftOrderUpdateResponse;

  if (json.errors?.length) {
    return {
      ok: false,
      message: json.errors
        .map((error) => error.message)
        .filter(Boolean)
        .join("; "),
    };
  }

  const payload = json.data?.draftOrderUpdate;
  const userErrors =
    payload?.userErrors?.filter((entry) => entry.message) ?? [];
  if (userErrors.length > 0) {
    return {
      ok: false,
      message: userErrors.map((entry) => entry.message).join("; "),
    };
  }

  const draftOrder = payload?.draftOrder;
  if (!draftOrder?.id) {
    return { ok: false, message: "draftOrderUpdate returned no draft order" };
  }

  return {
    ok: true,
    draftOrder: {
      id: draftOrder.id,
      name: draftOrder.name ?? null,
      email: draftOrder.email ?? null,
      status: draftOrder.status ?? null,
      reserveInventoryUntil: draftOrder.reserveInventoryUntil ?? null,
    },
  };
}

export type LiveDraftOrder = {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
  reserveInventoryUntil: string | null;
  invoiceSentAt: string | null;
  lineItems: Array<{
    title: string;
    quantity: number;
    sku: string | null;
    variantTitle: string | null;
  }>;
};

type DraftOrderQueryResponse = {
  data?: {
    draftOrder?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      status?: string | null;
      reserveInventoryUntil?: string | null;
      invoiceSentAt?: string | null;
      lineItems?: {
        nodes?: Array<{
          title?: string | null;
          quantity?: number | null;
          sku?: string | null;
          variantTitle?: string | null;
        } | null>;
      } | null;
    } | null;
  };
} & GraphqlErrorBody;

export async function fetchDraftOrder(
  admin: GraphqlClient,
  draftOrderGid: string,
): Promise<LiveDraftOrder | null> {
  const response = await admin.graphql(
    `#graphql
    query InvoiceHoldDraftOrder($id: ID!) {
      draftOrder(id: $id) {
        id
        name
        email
        status
        reserveInventoryUntil
        invoiceSentAt
        lineItems(first: 50) {
          nodes {
            title
            quantity
            sku
            variantTitle
          }
        }
      }
    }`,
    { variables: { id: draftOrderGid } },
  );
  const json = (await response.json()) as DraftOrderQueryResponse;
  if (json.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join("; "));
  }

  const draft = json.data?.draftOrder;
  if (!draft?.id) return null;

  return {
    id: draft.id,
    name: draft.name ?? null,
    email: draft.email ?? null,
    status: draft.status ?? null,
    reserveInventoryUntil: draft.reserveInventoryUntil ?? null,
    invoiceSentAt: draft.invoiceSentAt ?? null,
    lineItems: (draft.lineItems?.nodes ?? []).flatMap((node) => {
      if (!node) return [];
      const quantity = Number(node.quantity ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return [];
      return [
        {
          title: node.title?.trim() || "Line item",
          quantity: Math.floor(quantity),
          sku: node.sku?.trim() || null,
          variantTitle: node.variantTitle?.trim() || null,
        },
      ];
    }),
  };
}
