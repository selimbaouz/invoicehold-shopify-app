import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  formatExpiresIn,
  holdStatusLabel,
  holdStatusTone,
} from "../lib/hold-display";
import { markExpiredHolds } from "../lib/process-draft.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await markExpiredHolds(session.shop);

  const holds = await prisma.hold.findMany({
    where: { shop: session.shop },
    orderBy: { reservedAt: "desc" },
    take: 100,
  });

  return {
    holds: holds.map((hold) => ({
      id: hold.id,
      draftOrderName: hold.draftOrderName,
      invoiceEmail: hold.invoiceEmail,
      quantitySummary: hold.quantitySummary,
      expiresAt: hold.expiresAt.toISOString(),
      status: hold.status,
    })),
  };
};

export default function HoldsIndex() {
  const { holds } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const isRefreshing = revalidator.state === "loading";
  const now = new Date();

  return (
    <s-page heading="Holds">
      <s-button
        slot="primary-action"
        href="/app/settings"
      >
        Settings
      </s-button>
      {holds.length > 0 ? (
        <s-button
          slot="secondary-actions"
          loading={isRefreshing || undefined}
          onClick={() => revalidator.revalidate()}
        >
          Refresh
        </s-button>
      ) : null}

      {holds.length === 0 ? (
        <s-section>
          <s-stack gap="base">
            <s-paragraph>
              Shopify does not hold stock when you send a draft invoice unless
              you click Reserve items. InvoiceHold does that for you, with an
              expiry.
            </s-paragraph>
            <s-paragraph>
              Create and send invoices in Shopify Admin → Draft orders. Holds
              appear here after an invoice is sent.
            </s-paragraph>
            <s-button href="/app/help">How it works</s-button>
          </s-stack>
        </s-section>
      ) : (
        <s-section padding="none">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Draft</s-table-header>
              <s-table-header listSlot="labeled">Customer</s-table-header>
              <s-table-header listSlot="labeled">Qty</s-table-header>
              <s-table-header listSlot="labeled">Expires</s-table-header>
              <s-table-header listSlot="labeled">Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {holds.map((hold) => (
                <s-table-row key={hold.id}>
                  <s-table-cell>
                    <s-link href={`/app/holds/${hold.id}`}>
                      {hold.draftOrderName || "Draft order"}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{hold.invoiceEmail || "—"}</s-table-cell>
                  <s-table-cell>{hold.quantitySummary}</s-table-cell>
                  <s-table-cell>
                    {hold.status === "active"
                      ? formatExpiresIn(new Date(hold.expiresAt), now)
                      : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={holdStatusTone(hold.status)}>
                      {holdStatusLabel(hold.status)}
                    </s-badge>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
