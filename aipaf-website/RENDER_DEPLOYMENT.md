# Render Deployment Guide for AIPAF Website

This guide explains how to deploy the AIPAF website backend on Render.com.

## Prerequisites

1. A Render account (free tier available)
2. A PostgreSQL database (Render Postgres recommended)
3. A Resend account for email
4. (Optional) Paystack account for payments

## 1. Database Setup

### Create PostgreSQL Database on Render

1. Go to Render Dashboard → New → PostgreSQL
2. Choose a name (e.g., `aipaf-db`)
3. Select the Free tier
4. Create the database
5. Copy the **Internal Database URL** from the database dashboard
6. This is your `DATABASE_URL`

### Run Database Migration

Once you have the `DATABASE_URL`, run the migration locally:

```bash
# Set the DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Run the migration
npm run db:migrate
```

## 2. Deploy the Web Service

### Option A: Using render.yaml (Recommended)

1. Push your code to GitHub
2. Go to Render Dashboard → New → Blueprint
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. Review the configuration and deploy

### Option B: Manual Setup

1. Go to Render Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: aipaf-website
   - **Region**: Oregon (or closest to your users)
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.mjs`
4. Click **Create Web Service**

## 3. Configure Environment Variables

In your Render web service, add the following environment variables:

### Required Variables

```text
SITE_URL=https://your-app-name.onrender.com
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=a_very_long_random_string_at_least_32_chars
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=AIPAF Website <noreply@your-domain.com>
SECRETARIAT_EMAIL=info@aipafgh.org
ADMIN_SECRETARIAT_KEY=a_very_long_random_string_at_least_32_chars
ADMIN_COUNCIL_KEY=a_different_very_long_random_string_at_least_32_chars
CERTIFICATE_SECRET=a_very_long_random_string_at_least_32_chars
```

### Optional Variables (for payments)

```text
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
PAYMENT_WEBHOOK_SECRET=a_very_long_random_string_at_least_32_chars
```

### How to Generate Secure Secrets

Run this command to generate secure random strings:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Configure Email (Resend)

1. Create a Resend account at https://resend.com
2. Go to API Keys and create an API key
3. Copy the API key as `RESEND_API_KEY`
4. Configure your sending domain in Resend
5. Add the required DNS records (SPF, DKIM, DMARC) to your domain
6. Set `EMAIL_FROM` to use your verified domain
7. Set `SECRETARIAT_EMAIL` to the email that should receive notifications

## 5. Configure Paystack (Optional)

1. Create a Paystack account at https://paystack.co
2. Go to Settings → API Keys
3. Copy the Secret Key as `PAYSTACK_SECRET_KEY`
4. Generate a webhook secret and set it as `PAYMENT_WEBHOOK_SECRET`
5. Configure the webhook URL in Paystack:
   ```
   https://your-app-name.onrender.com/api/member-records?action=webhook
   ```

## 6. Post-Deployment Verification

After deployment, verify the following:

1. **Health Check**: Visit `https://your-app-name.onrender.com/api/health`
   - Should return `{"ok":true,"database":"connected"}`

2. **Contact Form**: Visit the contact page and submit a test message
   - Check that the submission is stored in the database
   - Verify the notification email is sent to `SECRETARIAT_EMAIL`

3. **Admin Login**: Visit `/admin-login`
   - Test login with the Secretariat key
   - Verify you can access `/admin`
   - Test the Council key (should have read-only access)

4. **Member Registration**: Visit `/member-register`
   - Create a test account
   - Verify email verification is sent
   - Complete the verification flow

5. **Payment Flow** (if configured):
   - Create a payment checkout
   - Complete a test payment
   - Verify the webhook updates the payment status

## 7. Custom Domain (Optional)

To use a custom domain:

1. In Render, go to your web service → Settings → Custom Domains
2. Add your domain (e.g., `aipafgh.org`)
3. Update your DNS records as instructed by Render
4. Update `SITE_URL` environment variable to your custom domain
5. Update Resend sending domain configuration

## 8. Monitoring and Logs

- View logs in Render Dashboard → Logs
- Monitor database performance in Render Postgres dashboard
- Set up error monitoring (e.g., Sentry) for production

## 9. Security Checklist

- [ ] All secrets are in Render environment variables (not in code)
- [ ] Admin keys are long and random (32+ characters)
- [ ] Database is not publicly accessible
- [ ] HTTPS is enabled (automatic on Render)
- [ ] Email domain is verified in Resend
- [ ] Webhook secrets are shared only with payment provider
- [ ] Regular backups are enabled for PostgreSQL

## 10. Scaling

The free tier on Render has limitations:
- **Web Service**: 512MB RAM, free SSL, auto-sleeps after 15min inactivity
- **PostgreSQL**: 90 days free, then $7/month

For production, consider:
- Render Starter plan ($7/month) - prevents sleep
- Paid PostgreSQL plan for better performance
- CDN for static assets

## Troubleshooting

### Build Fails

- Check the build logs in Render
- Ensure `package.json` has correct start command
- Verify Node.js version compatibility (18+)

### Database Connection Fails

- Verify `DATABASE_URL` is correct
- Check if PostgreSQL is running
- Ensure network allows connection

### Emails Not Sending

- Verify `RESEND_API_KEY` is valid
- Check domain is verified in Resend
- Review Resend dashboard for error logs

### Webhook Not Receiving Payments

- Verify webhook URL is correct in Paystack
- Check `PAYMENT_WEBHOOK_SECRET` matches
- Ensure webhook is active in Paystack dashboard

## Support

For issues with:
- **Render**: https://render.com/docs
- **Resend**: https://resend.com/docs
- **Paystack**: https://paystack.com/docs
