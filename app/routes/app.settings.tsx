import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { HOLD_HOUR_PRESETS, parseHoldHours } from "../lib/hold";
import { holdHoursLabel } from "../lib/hold-display";
import {
  getOrCreateShopSetting,
  parseHoldTrigger,
  updateShopSetting,
} from "../lib/settings.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateShopSetting(session.shop);
  return {
    enabled: settings.enabled,
    holdHours: settings.holdHours,
    trigger: settings.trigger,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const preset = String(formData.get("holdHours") ?? "");
  const holdHours =
    preset === "custom"
      ? parseHoldHours(formData.get("customHoldHours"))
      : parseHoldHours(preset);

  await updateShopSetting(session.shop, {
    enabled: String(formData.get("enabled")) === "true",
    holdHours,
    trigger: parseHoldTrigger(formData.get("trigger")),
  });
  return { saved: true };
};

export default function SettingsPage() {
  const settings = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isSaving = navigation.state === "submitting";
  const isPreset = (HOLD_HOUR_PRESETS as readonly number[]).includes(
    settings.holdHours,
  );
  const [duration, setDuration] = useState(
    isPreset ? String(settings.holdHours) : "custom",
  );

  useEffect(() => {
    if (actionData?.saved) {
      shopify.toast.show("Settings saved");
    }
  }, [actionData, shopify]);

  return (
    <s-page heading="Settings">
      <s-section heading="Auto-hold">
        <s-paragraph>
          Shopify Flow can reserve inventory on a draft. InvoiceHold adds an
          expiry, a holds list, and an invoice-send trigger so test drafts are
          not reserved.
        </s-paragraph>
        <s-paragraph>
          New invoices use the default duration below. On any hold, you can pick
          an exact expiry date and time.
        </s-paragraph>
      </s-section>

      <s-section>
        <Form method="post">
          <s-stack gap="base">
            <s-select
              name="enabled"
              label="Automatically hold inventory"
              value={settings.enabled ? "true" : "false"}
            >
              <s-option value="true">On</s-option>
              <s-option value="false">Off</s-option>
            </s-select>

            <s-select
              name="holdHours"
              label="Default hold duration"
              value={duration}
              onChange={(event) => setDuration(event.currentTarget.value)}
            >
              {HOLD_HOUR_PRESETS.map((hours) => (
                <s-option key={hours} value={String(hours)}>
                  {holdHoursLabel(hours)}
                </s-option>
              ))}
              <s-option value="custom">Custom hours…</s-option>
            </s-select>

            {duration === "custom" ? (
              <s-stack gap="small-200">
                <s-text-field
                  label="Custom hours"
                  name="customHoldHours"
                  defaultValue={String(settings.holdHours)}
                />
                <s-paragraph>
                  1 to 8,760 hours (up to one year). Applies to new invoices.
                </s-paragraph>
              </s-stack>
            ) : null}

            <s-select
              name="trigger"
              label="When to hold"
              value={settings.trigger}
            >
              <s-option value="invoice_sent">On invoice send (default)</s-option>
              <s-option value="draft_created">On draft create</s-option>
            </s-select>
            <s-paragraph>
              Invoice send uses draft_orders/update with status invoice_sent or
              invoice_sent_at. invoice_url exists on every draft, so it is not
              used.
            </s-paragraph>

            <s-button
              type="submit"
              variant="primary"
              loading={isSaving || undefined}
            >
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
