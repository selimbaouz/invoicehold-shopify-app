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

function isProtectedFieldError(message: string): boolean {
  return /not approved to (use|access) the \w+ field/i.test(message);
}

function graphqlErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function graphqlBodyFromThrown(error: unknown): GraphqlErrorBody | null {
  if (!error || typeof error !== "object") return null;
  const record = error as {
    body?: unknown;
    response?: unknown;
  };
  if (record.body && typeof record.body === "object") {
    return record.body as GraphqlErrorBody;
  }
  if (record.response && typeof record.response === "object") {
    return record.response as GraphqlErrorBody;
  }
  return null;
}

async function adminGraphqlJson<T extends GraphqlErrorBody>(
  admin: GraphqlClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  try {
    const response = await admin.graphql(
      query,
      variables ? { variables } : undefined,
    );
    return (await response.json()) as T;
  } catch (error) {
    const body = graphqlBodyFromThrown(error);
    if (body) return body as T;
    throw error;
  }
}

function blockingGraphqlErrors(errors: Array<{ message?: string }> | undefined) {
  return (
    errors?.filter(
      (error) => error.message && !isProtectedFieldError(error.message),
    ) ?? []
  );
}

/**
 * Sets Shopify's native draft-order reservation expiry.
 * Passing a Date reserves until that instant.
 * Passing null sets a past timestamp so Shopify releases stock — we do not
 * write a second inventory adjustment.
 *
 * Do not select DraftOrder.email here: that field needs Partner Dashboard
 * protected-customer-data approval and would fail the whole mutation.
 */
export async function applyReserveInventoryUntil(
  admin: GraphqlClient,
  draftOrderGid: string,
  until: Date | null,
): Promise<ReserveInventoryResult> {
  const reserveInventoryUntil = (
    until ?? new Date(Date.now() - 1000)
  ).toISOString();

  const json = await adminGraphqlJson<DraftOrderUpdateResponse>(
    admin,
    DRAFT_ORDER_RESERVE_MUTATION,
    {
      id: draftOrderGid,
      input: { reserveInventoryUntil },
    },
  );

  const blocking = blockingGraphqlErrors(json.errors);
  if (blocking.length > 0) {
    return {
      ok: false,
      message: blocking
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
    return {
      ok: false,
      message:
        json.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
        "draftOrderUpdate returned no draft order",
    };
  }

  return {
    ok: true,
    draftOrder: {
      id: draftOrder.id,
      name: draftOrder.name ?? null,
      status: draftOrder.status ?? null,
      reserveInventoryUntil: draftOrder.reserveInventoryUntil ?? null,
    },
  };
}

export type LiveDraftOrder = {
  id: string;
  name: string | null;
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
  const json = await adminGraphqlJson<DraftOrderQueryResponse>(
    admin,
    `#graphql
    query InvoiceHoldDraftOrder($id: ID!) {
      draftOrder(id: $id) {
        id
        name
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
    { id: draftOrderGid },
  );

  const blocking = blockingGraphqlErrors(json.errors);
  if (blocking.length > 0) {
    throw new Error(
      blocking
        .map((error) => error.message)
        .filter(Boolean)
        .join("; ") || graphqlErrorMessage(json.errors),
    );
  }

  const draft = json.data?.draftOrder;
  if (!draft?.id) return null;

  return {
    id: draft.id,
    name: draft.name ?? null,
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
