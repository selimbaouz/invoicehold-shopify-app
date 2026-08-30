import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  expiryEditorDefaults,
  parseExpiryDateTime,
  toLocalDateString,
  toLocalTimeString,
} from "../lib/hold";
import {
  canChangeHoldExpiry,
  canReleaseHold,
  expiryTimeOptions,
  formatExpiresIn,
  holdStatusLabel,
  holdStatusTone,
  shopifyDraftAdminHref,
} from "../lib/hold-display";
import {
  deleteHold,
  markExpiredHolds,
  releaseHoldNow,
  updateHoldExpiry,
} from "../lib/process-draft.server";
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
      draftAdminHref: shopifyDraftAdminHref(hold.draftOrderId),
      quantitySummary: hold.quantitySummary,
      expiresAt: hold.expiresAt.toISOString(),
      status: hold.status,
      errorMessage: hold.errorMessage,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const holdId = String(formData.get("holdId") ?? "").trim();
  if (!holdId) {
    return { ok: false, message: "Hold not found" };
  }

  if (intent === "delete") {
    return deleteHold({ admin, shop: session.shop, holdId });
  }

  if (intent === "release") {
    return releaseHoldNow({ admin, shop: session.shop, holdId });
  }

  if (intent === "update-expiry") {
    const parsed = parseExpiryDateTime(
      formData.get("expiresDate"),
      formData.get("expiresTime"),
    );
    if (!parsed.ok) return parsed;
    return updateHoldExpiry({
      admin,
      shop: session.shop,
      holdId,
      expiresAt: parsed.expiresAt,
    });
  }

  return { ok: false, message: "Unknown action" };
};

function hideModal(id: string) {
  const modal = document.getElementById(id) as { hide?: () => void } | null;
  modal?.hide?.();
}

export default function HoldsIndex() {
  const { holds } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const isRefreshing = revalidator.state === "loading";
  const isBusy = fetcher.state !== "idle";
  const now = new Date();
  const today = toLocalDateString(now);
  const oneYear = toLocalDateString(
    new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000),
  );

  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingExpiry, setPendingExpiry] = useState<{
    id: string;
    name: string;
    date: string;
    time: string;
    canRelease: boolean;
    errorMessage: string | null;
  } | null>(null);

  const timeOptions = expiryTimeOptions(
    pendingExpiry
      ? new Date(
          `${pendingExpiry.date}T${pendingExpiry.time}:00`,
        )
      : now,
  );

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      shopify.toast.show(
        fetcher.data.ok
          ? fetcher.data.message ?? "Saved"
          : fetcher.data.message,
      );
      if (fetcher.data.ok) {
        setPendingDelete(null);
        setPendingExpiry(null);
        hideModal("delete-hold-modal");
        hideModal("edit-expiry-modal");
      }
    }
  }, [fetcher.data, fetcher.state, shopify]);

  return (
    <s-page heading="Holds">
      <s-button slot="primary-action" href="/app/settings">
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
              <s-table-header listSlot="labeled">Qty</s-table-header>
              <s-table-header listSlot="labeled">Expires</s-table-header>
              <s-table-header listSlot="labeled">Status</s-table-header>
              <s-table-header listSlot="labeled">Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {holds.map((hold) => (
                <s-table-row key={hold.id}>
                  <s-table-cell>
                    {hold.draftAdminHref ? (
                      <s-link href={hold.draftAdminHref}>
                        {hold.draftOrderName || "Draft order"}
                      </s-link>
                    ) : (
                      hold.draftOrderName || "Draft order"
                    )}
                  </s-table-cell>
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
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200">
                      {canChangeHoldExpiry(hold.status) ? (
                        <s-button
                          type="button"
                          variant="tertiary"
                          icon="edit"
                          accessibilityLabel="Change expiry"
                          commandFor="edit-expiry-modal"
                          command="--show"
                          disabled={isBusy || undefined}
                          onClick={() => {
                            const fields = expiryEditorDefaults(
                              new Date(hold.expiresAt),
                            );
                            setPendingExpiry({
                              id: hold.id,
                              name: hold.draftOrderName || "Draft order",
                              date: fields.date,
                              time: fields.time,
                              canRelease: canReleaseHold(hold.status),
                              errorMessage: hold.errorMessage,
                            });
                          }}
                        />
                      ) : null}
                      <s-button
                        type="button"
                        variant="tertiary"
                        tone="critical"
                        icon="delete"
                        accessibilityLabel="Delete hold"
                        commandFor="delete-hold-modal"
                        command="--show"
                        disabled={isBusy || undefined}
                        onClick={() =>
                          setPendingDelete({
                            id: hold.id,
                            name: hold.draftOrderName || "Draft order",
                          })
                        }
                      />
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-modal
        id="edit-expiry-modal"
        heading={
          pendingExpiry
            ? `Expiry for ${pendingExpiry.name}`
            : "Change expiry"
        }
      >
        {pendingExpiry?.errorMessage ? (
          <s-banner tone="critical" heading="Hold failed">
            {pendingExpiry.errorMessage}
          </s-banner>
        ) : null}
        <s-paragraph>
          Stock returns to the storefront at this time.
        </s-paragraph>
        <s-stack gap="base">
          <s-stack direction="inline" gap="base">
            <s-date-field
              label="Expires on"
              value={pendingExpiry?.date ?? today}
              allow={`${today}--${oneYear}`}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPendingExpiry((current) =>
                  current ? { ...current, date: value } : current,
                );
              }}
            />
            <s-select
              label="Time"
              value={pendingExpiry?.time ?? toLocalTimeString(now)}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPendingExpiry((current) =>
                  current ? { ...current, time: value } : current,
                );
              }}
            >
              {timeOptions.map((time) => (
                <s-option key={time} value={time}>
                  {time}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-stack>
        <s-button
          slot="secondary-actions"
          commandFor="edit-expiry-modal"
          command="--hide"
        >
          Cancel
        </s-button>
        {pendingExpiry?.canRelease ? (
          <s-button
            slot="secondary-actions"
            tone="critical"
            loading={isBusy || undefined}
            disabled={isBusy || undefined}
            onClick={() => {
              if (!pendingExpiry) return;
              const data = new FormData();
              data.set("intent", "release");
              data.set("holdId", pendingExpiry.id);
              fetcher.submit(data, { method: "POST" });
            }}
          >
            Release now
          </s-button>
        ) : null}
        <s-button
          slot="primary-action"
          variant="primary"
          loading={isBusy || undefined}
          disabled={!pendingExpiry || isBusy || undefined}
          onClick={() => {
            if (!pendingExpiry) return;
            const data = new FormData();
            data.set("intent", "update-expiry");
            data.set("holdId", pendingExpiry.id);
            data.set("expiresDate", pendingExpiry.date);
            data.set("expiresTime", pendingExpiry.time);
            fetcher.submit(data, { method: "POST" });
          }}
        >
          Save expiry
        </s-button>
      </s-modal>

      <s-modal id="delete-hold-modal" heading="Delete this hold?">
        <s-paragraph>
          {pendingDelete
            ? `“${pendingDelete.name}” will be removed from InvoiceHold. If stock is still reserved, it will be released in Shopify.`
            : "This hold will be removed. If stock is still reserved, it will be released in Shopify."}
        </s-paragraph>
        <s-button
          slot="secondary-actions"
          commandFor="delete-hold-modal"
          command="--hide"
        >
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor="delete-hold-modal"
          command="--hide"
          loading={isBusy || undefined}
          disabled={!pendingDelete || isBusy || undefined}
          onClick={() => {
            if (!pendingDelete) return;
            const data = new FormData();
            data.set("intent", "delete");
            data.set("holdId", pendingDelete.id);
            fetcher.submit(data, { method: "POST" });
          }}
        >
          Delete
        </s-button>
      </s-modal>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
