# Vercel deployment and launch setup

## 1. Prepare the Vercel project

1. Import the repository into Vercel.
2. Set the framework preset to **Other** and use the root directory.
3. Set the production build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add the required environment variables in **Project Settings → Environment Variables**:

```text
SITE_URL=https://your-domain.example
DATABASE_URL=postgresql://user:password@host:5432/aipaf
SESSION_SECRET=replace_with_a_long_random_secret
RESEND_API_KEY=re_your_key
EMAIL_FROM=AIPAF Website <noreply@your-domain.example>
SECRETARIAT_EMAIL=info@your-domain.example
ADMIN_SECRETARIAT_KEY=replace_with_a_long_random_secret
ADMIN_COUNCIL_KEY=replace_with_a_different_long_random_secret
PAYMENT_WEBHOOK_SECRET=replace_with_a_long_random_secret
CERTIFICATE_SECRET=replace_with_a_long_random_secret
```

Do not provide these values in source control or the browser. Use distinct long random values for each secret. The payment webhook secret must be shared only with the payment provider and the application deployment. The certificate secret is used to sign public verification tokens and must remain stable for every certificate issued.

## 2. Create the database

Run the schema migration after the `DATABASE_URL` production variable is available:

```bash
npm run db:migrate
```

The schema creates the member, payment, examination, CPD, CMS, contact, and membership tables with indexes and status constraints.

## 3. Configure email

Before activating production emails, configure the sender domain in Resend and publish the required SPF, DKIM, and DMARC records for the domain. The domain must match the value used in `EMAIL_FROM`.

## 4. Configure Paystack

Add the following Vercel environment variables:

```text
PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYMENT_WEBHOOK_SECRET=replace_with_a_long_random_secret
```

The `PAYSTACK_SECRET_KEY` creates payment transactions and is used only server-side. The `PAYSTACK_PUBLIC_KEY` is not required by the current server integration but is useful for any future client-side Paystack initialization.

Configure the Paystack webhook URL to:

```text
https://your-domain.example/api/member-records?action=webhook
```

Set the webhook secret in Paystack to the value of `PAYMENT_WEBHOOK_SECRET`. Paystack sends the payload signature in the `x-paystack-signature` header. Repeated successful or failed callbacks must be idempotent and must not change an already reconciled payment.

## 5. Deploy and verify

```bash
npm install
npm run test:backend
npm run build
```

After deployment:

1. Open the production site and submit a test contact form.
2. Verify that the submission is stored in PostgreSQL.
3. Verify the Secretariat notification email is delivered.
4. Test the acknowledgement email address.
5. Sign in at `/admin-login` with the Secretariat token, then use `/admin` to export a CSV.
6. Confirm that the Council token can read submissions but cannot mark them handled.
7. Create a member account, sign in, and confirm the authenticated member dashboard loads.
8. Create a payment checkout record using `/api/member-records?action=checkout` and confirm that the response contains a Paystack `authorizationUrl`.
9. Complete the Paystack test payment and confirm that the webhook transitions the payment to `paid`.
10. Create and register for an examination with the Secretariat API.
11. Submit a CPD record and confirm that the Secretariat can approve or reject it.
12. Verify the `/api/health` endpoint returns HTTP 200 when the database is available.
13. Verify that the privacy notice and consent checkbox are visible on public forms.

## 6. Security checklist

- Keep every secret in Vercel environment variables.
- Rotate admin keys if they are exposed.
- Use HTTPS only.
- Do not store secrets in URLs, logs, or client-side source.
- Keep database credentials out of the repository.
- Review the admin export and retention policy before publishing sensitive data.
- Configure backups and monitoring before production launch.
