# Cashfree setup for EveryMoment

Status: server adapter and verification helpers are prepared in `lib/cashfree.ts`. Cashfree is not active in checkout yet. Provider selection, order persistence, checkout, and webhook handling depend on the payment scope below. Existing gateways remain unchanged.

## Information needed

- Payment scope: guest RSVP/session fees, EveryMoment plan purchases, or both.
- Whether guest payments settle into one EveryMoment merchant account or each event owner's merchant account. Do not route host funds to the platform account without agreeing this model.
- Sandbox or production; start with sandbox for testing.
- Merchant App ID and Secret Key for that environment. Store them in Netlify environment variables (server Functions scope) or the ignored `.env.local` for local testing. Do not put keys in chat, source control, or variables starting with `NEXT_PUBLIC_`.
- Currency and plan prices; whether recurring subscriptions are needed. The prepared adapter covers one-time Payment Gateway orders; Cashfree Subscriptions is a separate integration.

Server environment variables:

```dotenv
CASHFREE_ENVIRONMENT=sandbox
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
```

## Merchant setup

1. Create/sign into the [Cashfree Merchant Dashboard](https://merchant.cashfree.com/merchants/login).
2. Generate sandbox Payment Gateway App ID and Secret Key, and save them securely as above. Production uses separate credentials and requires merchant activation.
3. Whitelist `https://everymoment.in` for web checkout; add the chosen test domain if testing on a preview domain.
4. Confirm the payment scope and settlement account. Then connect the adapter to the corresponding existing payment records and pricing rules.
5. Implement and deploy the webhook before registering its URL. Planned endpoint: `https://everymoment.in/api/webhooks/cashfree` (not implemented or active yet). Verify signatures using the raw request body and the matching Cashfree Secret Key. Process successful payments idempotently; never mark a payment paid solely from the return URL.
6. Test success, failure, cancellation, retries, duplicate webhooks, mismatched amounts/currencies, and forged signatures. Verify the event/session or plan updates exactly once.
7. After sandbox tests pass, set the production keys/environment, register the production webhook, redeploy, and complete a controlled live payment check.

## Integration design

Authorize the purchaser; calculate the price server-side; store a pending local payment with a stable Cashfree order ID and UUID idempotency key; create the order; use the returned payment session ID with Cashfree's hosted web checkout. On return and on signed success webhook, fetch the order server-side and match order ID, amount, currency, and PAID status before recording payment. Persist successful payment IDs with a uniqueness constraint and make fulfillment transactional. Unsuccessful retry notifications must not overwrite an already-paid order.

References:
- [Hosted web checkout and domain whitelisting](https://www.cashfree.com/docs/payments/online/web/redirect)
- [Create Order API](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create-order)
- [Get Order API](https://www.cashfree.com/docs/api-reference/payments/latest/orders/get-order)
- [Webhook signature verification](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification)
- [Webhook idempotency](https://www.cashfree.com/docs/payments/online/webhooks/webhook-indempotency)

## Admin setup
Sign in as platform administrator → Dashboard → Billing → Cashfree setup (`/admin/billing/cashfree`). Copy Sandbox App ID and Secret Key from Cashfree Payment Gateway → Developers → API Keys, choose Sandbox and save. The secret is encrypted at rest and never sent back to the form. Blank preserves it; changing environments requires the corresponding secret.

Apply the Cashfree credentials migration first. Set `CASHFREE_CREDENTIAL_ENCRYPTION_KEY` to a stable server-only random secret before saving, or retain the service-role key used for fallback encryption. Rotating that fallback key requires re-entering credentials. Saving keys does not enable checkout. Merchant approval, allowed domain, order/webhook integration and sandbox testing must precede live activation.
