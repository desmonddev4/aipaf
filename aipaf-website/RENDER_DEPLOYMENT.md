# Render Deployment Guide for AIPAF Website

This guide explains how to deploy the AIPAF website backend on Render.com using the Blueprint for a simple one-click deployment.

## Prerequisites

1. A Render account (free tier available) - Sign up at https://render.com
2. A Resend account for email - Sign up at https://resend.com
3. (Optional) Paystack account for payments - Sign up at https://paystack.co

## Quick Deploy (Blueprint Method - Recommended)

The `render.yaml` blueprint automatically creates:
- ✅ PostgreSQL database
- ✅ Web service with automatic database connection
- ✅ All required environment variables

### Steps:

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Ready for Render deployment"
   git push origin main
   ```

2. **Deploy using Blueprint**
   - Go to Render Dashboard → New → Blueprint
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`
   - Review the configuration (shows web service + database)
   - Click **Apply** to deploy

3. **Configure Environment Variables**
   - After deployment, go to your web service → Settings → Environment Variables
   - Fill in the required variables (see below)
   - The `DATABASE_URL` is already set automatically by the blueprint

4. **Run Database Migration**
   - Go to your PostgreSQL database in Render
   - Click **Connect** → **External Connection**
   - Copy the **Internal Database URL**
   - Run migration locally:
     ```bash
     export DATABASE_URL="paste_your_database_url_here"
     npm run db:migrate
     ```

That's it! Your site is now deployed.

---

## Manual Setup (Alternative)

If you prefer not to use the Blueprint, you can set up manually:

1. **Create PostgreSQL Database**
   - Go to Render Dashboard → New → PostgreSQL
   - Name it `aipaf-database`
   - Select Free tier
   - Create and copy the Internal Database URL

2. **Create Web Service**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Configure:
     - **Name**: aipaf-website
     - **Region**: Oregon (or closest to your users)
     - **Branch**: main
     - **Runtime**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server.mjs`
   - Click **Create Web Service**

3. **Add DATABASE_URL**
   - In web service → Settings → Environment Variables
   - Add `DATABASE_URL` with the database URL you copied

Then continue with the environment variables configuration above.

---

## Configure Environment Variables

In your Render web service (Settings → Environment Variables), add the following:

### Required Variables

```text
SITE_URL=https://your-app-name.onrender.com
SESSION_SECRET=a_very_long_random_string_at_least_32_chars
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=info@aipafgh.org
SMTP_PASS=your-zoho-app-password
EMAIL_FROM=AIPAF Website <info@aipafgh.org>
SECRETARIAT_EMAIL=info@aipafgh.org
ADMIN_SECRETARIAT_KEY=a_very_long_random_string_at_least_32_chars
ADMIN_COUNCIL_KEY=a_different_very_long_random_string_at_least_32_chars
CERTIFICATE_SECRET=a_very_long_random_string_at_least_32_chars
```

**Note:** `DATABASE_URL` is automatically set by the blueprint - no need to configure it manually.

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

## Configure Email (Zoho Mail)

The application uses Zoho Mail for sending emails via SMTP.

### Get Zoho Mail SMTP Credentials

1. Log in to your Zoho Mail account at https://mail.zoho.com
2. Go to **Settings** → **Mail Accounts** → **info@aipafgh.org**
3. Navigate to **SMTP Configuration** or **POP/IMAP/SMTP Access**
4. Enable SMTP access if not already enabled
5. Note down the SMTP settings:
   - **SMTP Host**: `smtp.zoho.com`
   - **SMTP Port**: `465` (SSL) or `587` (TLS)
   - **SMTP User**: Your full email address (`info@aipafgh.org`)
   - **SMTP Password**: Your Zoho account password or app-specific password

### Create App-Specific Password (Recommended)

For better security, create an app-specific password:

1. In Zoho Mail, go to **Settings** → **Security**
2. Find **App Passwords** or **Two-Factor Authentication**
3. Generate a new app-specific password for the website
4. Use this password as `SMTP_PASS` instead of your main password

### Configure in Render

Add these environment variables to your Render web service:

```text
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=info@aipafgh.org
SMTP_PASS=your-app-specific-password
EMAIL_FROM=AIPAF Website <info@aipafgh.org>
SECRETARIAT_EMAIL=info@aipafgh.org
```

### Important Notes

- Using `info@aipafgh.org` for both sending and receiving emails (free plan compatible)
- The `EMAIL_FROM` address must match the `SMTP_USER` for Zoho Mail
- Zoho Mail has daily sending limits on free plans (check your plan details)
- Ensure your domain's SPF, DKIM, and DMARC records are properly configured if using a custom domain

## Configure Paystack (Optional)

1. Create a Paystack account at https://paystack.co
2. Go to Settings → API Keys
3. Copy the Secret Key as `PAYSTACK_SECRET_KEY` in Render
4. Generate a webhook secret and set it as `PAYMENT_WEBHOOK_SECRET` in Render
5. Configure the webhook URL in Paystack:
   ```
   https://your-app-name.onrender.com/api/member-records?action=webhook
   ```

## Post-Deployment Verification

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
