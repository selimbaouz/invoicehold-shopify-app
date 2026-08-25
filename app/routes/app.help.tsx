import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function HelpPage() {
  return (
    <s-page heading="Help">
      <s-section heading="What does InvoiceHold do?">
        <s-paragraph>
          InvoiceHold reserves inventory when you send a Shopify draft order
          invoice, and sets an expiry. If the customer pays, Shopify turns the
          draft into an order. If they do not pay in time, stock returns to the
          storefront.
        </s-paragraph>
      </s-section>

      <s-section heading="What this app is not">
        <s-unordered-list>
          <s-list-item>
            Not a bundle app, and not SharedStock or BreakList.
          </s-list-item>
          <s-list-item>
            Not a storefront cart timer. InvoiceHold only holds stock on draft
            invoices, not checkout carts.
          </s-list-item>
          <s-list-item>
            Not a draft-order editor, RFQ tool, or B2B portal. You still create
            drafts and send invoices in Shopify Admin.
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="How do I use it?">
        <s-ordered-list>
          <s-list-item>
            Create a draft order in Shopify Admin as you already do.
          </s-list-item>
          <s-list-item>
            Send the invoice. InvoiceHold calls Shopify’s
            reserveInventoryUntil so those units are not sellable on the
            storefront.
          </s-list-item>
          <s-list-item>
            Watch holds on the Holds page. Change the expiry there, or open the
            draft in Shopify Admin to see line items.
          </s-list-item>
        </s-ordered-list>
      </s-section>

      <s-section heading="What does the Error badge mean?">
        <s-paragraph>
          The Error badge means Shopify could not reserve stock. Change the
          expiry to retry, or delete the hold. Failures are never silent.
        </s-paragraph>
      </s-section>

      <s-section heading="Support">
        <s-paragraph>
          Something not working, or a question about your store? Email us and
          we&apos;ll help.
        </s-paragraph>
        <s-paragraph>
          <s-link href="mailto:hello@brandionary.com">
            hello@brandionary.com
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-link href="/privacy" target="_blank">
            Privacy policy
          </s-link>
          {" · "}
          <s-link href="/terms" target="_blank">
            Terms
          </s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
