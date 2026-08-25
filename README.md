# InvoiceHold

InvoiceHold is an embedded Shopify app. When a merchant sends a **draft order invoice**, it reserves the line items in Shopify and sets an expiry. If the customer pays, the draft becomes an order (Shopify handles that). If they do not pay before expiry, stock returns to the storefront via Shopify’s native `reserveInventoryUntil`.

Merchants still create drafts and send invoices in **Shopify Admin**. InvoiceHold does not create quotes, PDFs, B2B portals, or discounts.

## What this is not

- Not a bundle app (not SharedStock, not BreakList)
- Not a storefront cart timer
- Not a draft-order editor / RFQ / checkout-from-draft suite
- No Billing API, no theme app extension, no checkout UI

## Pricing

**$14.99 USD / month.** One plan, billed through the Shopify Partner Dashboard / App Store listing (same pattern as SharedStock). Set it in Partner Dashboard → the app → **Distribution** / **Pricing** (Shopify App Pricing), not in this repo.

## Invoice-send trigger

Shopify has no dedicated “invoice sent” webhook. InvoiceHold subscribes to `draft_orders/create` and `draft_orders/update`, then reserves when:

- REST `status` is `invoice_sent`, or
- `invoice_sent_at` is set

`invoice_url` exists on every draft (checkout link), so it is **not** used as a send signal. Settings can switch to “On draft create” if you want every new draft reserved.

Default hold duration: **72 hours**. Webhook replays do not double-reserve or stack extra days (`shop + draftOrderId`, plus Shopify `webhookId` like SharedStock `ProcessedOrder`).

## Local development

```shell
npm install
npx prisma migrate deploy
shopify app dev
```

Open the app from the Shopify Admin of your development store. Create a draft order there, send the invoice, then check **Holds**.

### `automatically_update_urls_on_dev`

`shopify.app.toml` sets `automatically_update_urls_on_dev = true`. While `shopify app dev` is running, the CLI **overwrites the production app URL** with the tunnel. Do not run `shopify app dev` against the production app config once the app is live, or use a separate development app.

## Production

Use PostgreSQL in production (change `prisma/schema.prisma` `provider` to `postgresql` and set `DATABASE_URL`). Do not commit secrets; copy `.env.example`.

## Tests

```shell
npm test
```

Tests use Node’s built-in test runner (no Vitest), so they run without Rollup.

## Windows: Rollup blocked by App Control

If `npm run build` or `shopify app dev` fails with `@rollup/rollup-win32-x64-msvc` / “application control policy blocked this file”, Windows is blocking Rollup’s native `.node` binary. This repo overrides `rollup` with `@rollup/wasm-node`. After pulling, run `npm install` again.

## Protected customer data (required for `shopify app dev`)

Draft order webhooks are protected customer data. Until the app requests that access, Shopify CLI fails with:

`This app is not approved to subscribe to webhook topics containing protected customer data.`

For a development store you do **not** wait for App Store review:

1. [Partner Dashboard](https://partners.shopify.com/current/apps) → **InvoiceHold**.
2. If asked, set distribution to **Shopify App Store** (or Public).
3. Sidebar → **API access requests** → **Protected customer data access** → **Request access**.
4. Enable **Protected customer data**. Reason: reserve inventory when a draft invoice is sent and list holds in the embedded admin.
5. Enable the **Email** field. Reason: show the invoice email on the Holds screen.
6. Save. Then run `npm run dev` again.

Webhooks only include `id`, `name`, `status`, `invoice_sent_at`, and `line_items` (no address/phone). Email for display is read later via Admin GraphQL.
