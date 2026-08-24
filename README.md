# InvoiceHold

InvoiceHold is an embedded Shopify app. When a merchant sends a **draft order invoice**, it reserves the line items in Shopify and sets an expiry. If the customer pays, the draft becomes an order (Shopify handles that). If they do not pay before expiry, stock returns to the storefront via Shopify’s native `reserveInventoryUntil`.

Merchants still create drafts and send invoices in **Shopify Admin**. InvoiceHold does not create quotes, PDFs, B2B portals, or discounts.

## What this is not

- Not a bundle app (not SharedStock, not BreakList)
- Not a storefront cart timer
- Not a draft-order editor / RFQ / checkout-from-draft suite
- No Billing API, no theme app extension, no checkout UI

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
