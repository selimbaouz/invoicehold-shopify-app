import styles from "../styles/legal.module.css";

export const meta = () => [{ title: "Privacy policy — InvoiceHold" }];

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <p className={styles.nav}>
          <a href="/">InvoiceHold</a>
          <a href="/terms">Terms</a>
        </p>
        <h1>Privacy policy</h1>
        <p className={styles.updated}>Last updated: August 24, 2026</p>
        <p>
          InvoiceHold is an embedded Shopify app published by Brandionary. This
          policy explains what we store when a merchant installs the app. It
          applies to merchants and, where relevant, their customers.
        </p>

        <h2>Who we are</h2>
        <p>
          Brandionary operates InvoiceHold. Questions about this policy or a
          data request:{" "}
          <a href="mailto:hello@brandionary.com">hello@brandionary.com</a>.
        </p>

        <h2>What we collect</h2>
        <p>
          InvoiceHold reserves inventory on Shopify draft order invoices. We
          store only what that job needs:
        </p>
        <ul>
          <li>Shop domain and Shopify OAuth session (access token).</li>
          <li>
            Staff account fields Shopify sends during login (name, email), used
            only to keep the session valid.
          </li>
          <li>
            Draft order IDs, draft names, hold timestamps, status, and a line
            item snapshot for the Holds screen.
          </li>
          <li>
            Customer email only when Shopify already attached it to the draft,
            so merchants can recognize the quote. We do not store addresses or
            phone numbers.
          </li>
          <li>
            Webhook event IDs so the same Shopify delivery is never processed
            twice.
          </li>
        </ul>

        <h2>How we use data</h2>
        <p>
          We use this data to call Shopify&apos;s draft order reservation API,
          show holds in the embedded admin, and keep the app authenticated. We
          do not sell personal data, and we do not use it for advertising.
        </p>

        <h2>Where data is stored</h2>
        <p>
          The app and its database are hosted by Brandionary (SQLite in
          development, PostgreSQL in production). Shopify also holds merchant
          and customer data under Shopify&apos;s own policies.
        </p>

        <h2>Sharing</h2>
        <p>
          We share data with Shopify (API calls required to reserve inventory)
          and with our hosting provider. We do not share it with other third
          parties except if the law requires it.
        </p>

        <h2>Retention</h2>
        <p>
          Shop data is kept while the app is installed. After uninstall,
          Shopify asks us to delete shop data (typically within 48 hours). We
          then delete sessions, settings, holds, logs, and webhook IDs for that
          shop. Draft emails are cleared when Shopify sends a customer
          redaction request.
        </p>

        <h2>Your rights</h2>
        <p>
          Merchants can uninstall the app at any time. Shopify also forwards
          customer data and deletion requests to us. We respond to those
          webhooks and complete deletion within 30 days. For any other request,
          email{" "}
          <a href="mailto:hello@brandionary.com">hello@brandionary.com</a>.
        </p>

        <h2>Children</h2>
        <p>
          InvoiceHold is a merchant tool. It is not directed at children and
          does not knowingly collect data from children.
        </p>
      </article>
    </main>
  );
}
