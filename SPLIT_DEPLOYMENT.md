# Split Deployment Guide: Vercel Frontend + Render Backend

This guide explains how to deploy the AIPAF website with a split architecture:
- **Frontend**: Static files on Vercel (https://aipafgh.org)
- **Backend**: API-only service on Render (https://aipaf-backend.onrender.com)

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Vercel        │         │   Render        │
│   Frontend      │────────▶│   Backend API   │
│   (Static)      │  HTTPS  │   (Node.js)     │
└─────────────────┘         └─────────────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │   PostgreSQL    │
                           │   (Render)      │
                           └─────────────────┘
```

## Prerequisites

1. Vercel account (free tier available) - https://vercel.com
2. Render account (free tier available) - https://render.com
3. A GitHub repository with this code
4. Domain name (e.g., aipafgh.org) configured on Vercel

## Step 1: Deploy Backend on Render

### Using Blueprint (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for split deployment"
   git push origin main
   ```

2. **Deploy Backend with Blueprint**
   - Go to Render Dashboard → New → Blueprint
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`
   - Review the configuration (shows web service + database)
   - Click **Apply** to deploy

3. **Configure Environment Variables**
   After deployment, go to your web service → Settings → Environment Variables and set:

   ```text
   SITE_URL=https://aipafgh.org
   FRONTEND_URL=https://aipafgh.org
   SESSION_SECRET=your_long_random_secret_at_least_32_chars
   SMTP_HOST=smtp.zoho.com
   SMTP_PORT=465
   SMTP_USER=info@aipafgh.org
   SMTP_PASS=your_zoho_app_password
   EMAIL_FROM=AIPAF <info@aipafgh.org>
   SECRETARIAT_EMAIL=info@aipafgh.org
   PAYMENT_WEBHOOK_SECRET=your_webhook_secret
   CERTIFICATE_SECRET=your_certificate_secret
   PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
   ```

   **Note**: `DATABASE_URL` is automatically set by the blueprint - no need to configure it manually.

4. **Run Database Migration**
   - Go to your PostgreSQL database in Render
   - Click **Connect** → **External Connection**
   - Copy the **Internal Database URL**
   - Run migration locally:
     ```bash
     export DATABASE_URL="paste_your_database_url_here"
     npm run db:migrate
     ```

   The schema creates the member, payment, examination, CPD, CMS, contact, membership, and admin_users tables with indexes and status constraints.

5. **Create First Admin User**
   After migration, create the first admin user:
   ```bash
   npm run create-admin info@aipafgh.org yourSecurePassword123 secretariat
   ```

   This creates an admin with:
   - Email: `info@aipafgh.org`
   - Password: `yourSecurePassword123` (replace with a strong password)
   - Role: `secretariat` (full access)

   See [ADMIN_AUTHENTICATION.md](./ADMIN_AUTHENTICATION.md) for more details.

5. **Note the Backend URL**
   - Your backend will be available at: `https://aipaf-backend.onrender.com`
   - Or your custom Render service name: `https://your-service-name.onrender.com`
   - **Save this URL** - you'll need it for the frontend deployment

### Manual Setup (Alternative)

If you prefer not to use the Blueprint:

1. **Create PostgreSQL Database**
   - Go to Render Dashboard → New → PostgreSQL
   - Name it `aipaf-database`
   - Select Free tier
   - Create and copy the Internal Database URL

2. **Create Web Service**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Configure:
     - **Name**: aipaf-backend
     - **Region**: Oregon (or closest to your users)
     - **Branch**: main
     - **Runtime**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server.mjs`
   - Click **Create Web Service**

3. **Add DATABASE_URL**
   - In web service → Settings → Environment Variables
   - Add `DATABASE_URL` with the database URL you copied

4. **Add Other Environment Variables**
   Add all the other required environment variables listed in step 3 above (except DATABASE_URL which you already added).

   **Important**: Set `FRONTEND_URL` to your Vercel domain (e.g., `https://aipafgh.org`) for better CORS security. Set to `*` during development if needed.

5. **Run Database Migration**
   Run the migration to create all tables including admin_users:
   ```bash
   export DATABASE_URL="paste_your_database_url_here"
   npm run db:migrate
   ```

6. **Create First Admin User**
   ```bash
   npm run create-admin info@aipafgh.org yourSecurePassword123 secretariat
   ```

   See [ADMIN_AUTHENTICATION.md](./ADMIN_AUTHENTICATION.md) for more details.

Then continue with the database migration step above.

## Step 2: Deploy Frontend on Vercel

### Deploy Static Site

1. **Import the repository into Vercel**
   - Go to Vercel Dashboard → Add New Project
   - Import your GitHub repository
   - Select the `frontend` directory

2. **Configure Vercel Project**
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Add Environment Variables**
   In Vercel Project Settings → Environment Variables, add:

   ```text
   SITE_URL=https://aipafgh.org
   API_BASE_URL=https://aipaf-backend.onrender.com
   ```

   **Note**: The default `API_BASE_URL` in the code is `https://aipaf-backend.onrender.com`. If your Render service has a different name, update it here.

   **Important**: Replace `API_BASE_URL` with your actual Render backend URL from Step 1. The build script will automatically inject this value into the frontend config.

4. **Configure Custom Domain**
   - In Vercel, go to Settings → Domains
   - Add your domain (e.g., `aipafgh.org`)
   - Update DNS records as instructed by Vercel
   - Wait for SSL certificate to be issued

5. **Deploy**
   - Click **Deploy**
   - Vercel will build the static site and deploy it

## Step 3: Configure Paystack Webhook

Update your Paystack webhook URL to point to the Render backend:

```text
https://aipaf-backend.onrender.com/api/member-records?action=webhook
```

## Verification

After both deployments are complete:

### 1. Verify Backend API
```bash
curl https://aipaf-backend.onrender.com/api/health
```
Should return: `{"ok":true,"database":"connected"}`

### 2. Verify Frontend
- Visit your Vercel URL (e.g., https://aipafgh.org)
- Submit a test contact form
- Check that the submission is stored in the database
- Verify the notification email is sent

### 3. Verify Admin Access
- Visit `/admin-login` on your Vercel site
- Test login with the Secretariat key
- Verify you can access `/admin`
- Test the Council key (should have read-only access)

### 4. Verify Member Registration
- Visit `/member-register` on your Vercel site
- Create a test account
- Verify email verification is sent
- Complete the verification flow

### 5. Verify Payment Flow (if configured)
- Create a payment checkout
- Complete a test payment
- Verify the webhook updates the payment status

## Security Checklist

- [ ] All secrets are in Render environment variables (not in code)
- [ ] All secrets are in Vercel environment variables (not in code)
- [ ] Admin passwords are strong (12+ characters, mixed case, numbers, symbols)
- [ ] Database is not publicly accessible
- [ ] HTTPS is enabled on both Vercel and Render (automatic)
- [ ] Email domain is verified in Zoho Mail
- [ ] Webhook secrets are shared only with payment provider
- [ ] Regular backups are enabled for PostgreSQL
- [ ] Admin users are created with appropriate roles (secretariat vs council)
- [ ] SMTP uses app-specific passwords, not main account password

## Environment Variables Summary

### Vercel (Frontend)
```text
SITE_URL=https://aipafgh.org
API_BASE_URL=https://aipaf-backend.onrender.com
```

### Render (Backend)
```text
DATABASE_URL=postgresql://...
SITE_URL=https://aipafgh.org
FRONTEND_URL=https://aipafgh.org
SESSION_SECRET=...
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=info@aipafgh.org
SMTP_PASS=...
EMAIL_FROM=AIPAF <info@aipafgh.org>
SECRETARIAT_EMAIL=info@aipafgh.org
PAYMENT_WEBHOOK_SECRET=...
CERTIFICATE_SECRET=...
PAYSTACK_SECRET_KEY=sk_test_...
```

**Note**: Admin users are now managed in the database using email/password authentication. See [ADMIN_AUTHENTICATION.md](./ADMIN_AUTHENTICATION.md) for details.

## CORS Configuration

The backend server (`server.mjs`) automatically adds CORS headers to allow requests from the Vercel frontend:

```javascript
headers['Access-Control-Allow-Origin'] = '*';
headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
```

For production, you may want to restrict `Access-Control-Allow-Origin` to your specific Vercel domain instead of `*`.

## Updating the Frontend

When you make changes to the frontend:

1. Commit and push to GitHub
2. Vercel will automatically rebuild and deploy
3. No backend changes needed

## Updating the Backend

When you make changes to the backend:

1. Commit and push to GitHub
2. Render will automatically rebuild and deploy
3. No frontend changes needed (unless API contracts change)

## Troubleshooting

### Frontend Cannot Connect to Backend

- Verify `API_BASE_URL` in Vercel environment variables matches your Render backend URL
- Check that the backend is deployed and running
- Verify CORS headers are present in backend responses
- Check browser console for CORS errors

### Backend API Returns 404

- Verify the `server.mjs` is being used (not the old Vercel API handler)
- Check that the route exists in the route map
- Verify the path is correct (e.g., `/api/contact` not `/contact`)

### Database Connection Fails

- Verify `DATABASE_URL` is correct in Render
- Check if PostgreSQL is running
- Ensure network allows connection

### Emails Not Sending

- Verify SMTP credentials are correct
- Check Zoho Mail settings
- Review Render logs for errors

## Cost Summary

### Vercel (Frontend)
- **Free tier**: Unlimited static sites, custom domains, SSL
- **Cost**: $0/month

### Render (Backend)
- **Web Service**: Free tier (512MB RAM, auto-sleeps after 15min inactivity)
- **PostgreSQL**: Free for 90 days, then $7/month
- **Total**: $0/month initially, $7/month after 90 days

### Optional Upgrades
- **Render Starter**: $7/month (prevents sleep, better performance)
- **Paid PostgreSQL**: $7-$50/month (better performance)

## Support

For issues with:
- **Vercel**: https://vercel.com/docs
- **Render**: https://render.com/docs
- **Zoho Mail**: https://www.zoho.com/mail/help/
- **Paystack**: https://paystack.com/docs
