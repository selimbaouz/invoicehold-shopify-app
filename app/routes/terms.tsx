import styles from "../styles/legal.module.css";

export const meta = () => [{ title: "Terms of service — InvoiceHold" }];

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <p className={styles.nav}>
          <a href="/">InvoiceHold</a>
          <a href="/privacy">Privacy</a>
        </p>
        <h1>Terms of service</h1>
        <p className={styles.updated}>Last updated: August 24, 2026</p>
        <p>
          These terms govern use of InvoiceHold, an embedded Shopify app from
          Brandionary. By installing the app, you agree to them.
        </p>

        <h2>What InvoiceHold does</h2>
        <p>
          InvoiceHold reserves inventory on Shopify draft order invoices and
          sets an expiry using Shopify&apos;s native{" "}
          <code>reserveInventoryUntil</code> field. Merchants still create
          drafts and send invoices in Shopify Admin. The app does not create
          quotes, PDFs, discounts, B2B portals, or theme/checkout extensions.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>
            You create and send draft invoices in Shopify. InvoiceHold does not
            replace Draft orders.
          </li>
          <li>
            You choose hold duration and trigger in Settings. Test drafts are
            not reserved when the trigger is “On invoice send”.
          </li>
          <li>
            You remain responsible for your storefront, orders, and refunds.
          </li>
        </ul>

        <h2>Billing</h2>
        <p>
          Paid use is billed through the Shopify Partner Dashboard / App Store
          listing. Shopify handles charges, taxes, and cancellations.
          Uninstalling the app stops future charges according to Shopify&apos;s
          billing rules.
        </p>

        <h2>Availability</h2>
        <p>
          We aim to reserve stock when an invoice is sent, but we do not
          guarantee uninterrupted service. Shopify API limits, webhook delays,
          or missing draft permissions can affect holds. Check the Holds page
          if a reservation shows an error.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the extent allowed by law, Brandionary is not liable for lost
          sales, overselling, or other damages arising from use of the app. The
          app is provided as-is for draft-invoice inventory holds only.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="mailto:hello@brandionary.com">hello@brandionary.com</a>
        </p>
      </article>
    </main>
  );
}
