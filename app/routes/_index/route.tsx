import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Hold stock on draft invoices</h1>
        <p className={styles.text}>
          InvoiceHold reserves line items when you send a Shopify draft invoice,
          so the storefront cannot sell the same units before the customer pays.
          Open it from Shopify Admin → Apps after installing.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Invoice send</strong>. Holds start when the draft invoice is
            sent, not on every test draft.
          </li>
          <li>
            <strong>Expiry</strong>. Stock returns to the storefront if the
            customer does not pay in time.
          </li>
          <li>
            <strong>Shopify native</strong>. Uses reserveInventoryUntil. You
            still create drafts in Shopify Admin.
          </li>
        </ul>
        <p className={styles.legal}>
          <a href="/privacy">Privacy</a>
          {" · "}
          <a href="/terms">Terms</a>
        </p>
      </div>
    </div>
  );
}
