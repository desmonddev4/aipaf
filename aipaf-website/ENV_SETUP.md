# Environment Variables Setup

This document lists all required environment variables for the AIPAF website backend.

## Required Environment Variables

### Site Configuration
```
SITE_URL=https://aipaf.africa
```
The public URL of your site (used for canonical links, sitemap, etc.)

### Database Configuration
```
DATABASE_URL=postgresql://user:password@host:5432/aipaf
```
PostgreSQL connection string (Neon, Supabase, or Vercel Postgres)

### Session Security
```
SESSION_SECRET=your-long-random-session-secret-at-least-32-characters
```
Secret key for signing session cookies. Generate with:
```bash
openssl rand -base64 32
```

### Email Configuration (Resend)
```
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=AIPAF Website <noreply@your-domain.example>
SECRETARIAT_EMAIL=info@your-domain.example
```
- `RESEND_API_KEY`: Your Resend API key for transactional emails
- `EMAIL_FROM`: From address for automated emails
- `SECRETARIAT_EMAIL`: Secretariat email address for form submission notifications

### Admin Authentication
```
ADMIN_SECRETARIAT_KEY=your-long-random-secretariat-key
ADMIN_COUNCIL_KEY=your-long-random-council-key
```
API keys for admin access. Generate with:
```bash
openssl rand -base64 32
```
- `ADMIN_SECRETARIAT_KEY`: Full access for Secretariat
- `ADMIN_COUNCIL_KEY`: Read-only access for Council

### Payment Configuration (Paystack)
```
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
PAYMENT_WEBHOOK_SECRET=your-webhook-secret
```
- `PAYSTACK_SECRET_KEY`: Paystack secret key for payment processing
- `PAYSTACK_PUBLIC_KEY`: Paystack public key (optional, for client-side initialization)
- `PAYMENT_WEBHOOK_SECRET`: Secret for verifying Paystack webhooks (must match Paystack webhook configuration)

### Certificate Verification
```
CERTIFICATE_SECRET=your-long-random-certificate-signing-secret
```
Secret for signing certificate verification tokens (must remain stable across deployments)

## Setting Up Environment Variables

### For Vercel Deployment
1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add each variable with its value
4. Redeploy your project to apply changes

### For Local Development
Create a `.env.local` file in the project root with your values:
```bash
# .env.local
SITE_URL=http://localhost:3000
DATABASE_URL=postgresql://...
SESSION_SECRET=...
# ... other variables
```

**Important**: The `.env.local` file is already in `.gitignore` and will not be committed.

## Security Notes

- Never commit actual secrets to version control
- Use different random values for each secret
- For production, use environment-specific values
- Test payment webhooks in Paystack sandbox before going live
- Configure SPF, DKIM, and DMARC records for your email domain
- Rotate secrets if they are ever exposed

## Generating Secrets

Use OpenSSL to generate secure random secrets:
```bash
# Generate a 32-byte random secret
openssl rand -base64 32
```

Or use Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Testing Configuration

After setting up environment variables, test the backend:
```bash
npm run test:backend
```

The health check endpoint can verify database connectivity:
```bash
curl http://localhost:3000/api/health
```
