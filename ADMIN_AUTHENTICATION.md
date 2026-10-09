# Admin Authentication Guide

The AIPAF admin panel now uses email/password authentication with email verification instead of API keys. This is more user-friendly for non-technical administrators.

## Overview

Admin users authenticate using:
1. **Email** - Their email address
2. **Password** - A secure password (minimum 8 characters)
3. **Verification Code** - A 6-digit code sent to their email (valid for 10 minutes)

## Authentication Flow

```
1. Admin enters email and password
   ↓
2. Backend verifies credentials
   ↓
3. Backend generates 6-digit verification code
   ↓
4. Code is sent to admin's email via SMTP
   ↓
5. Admin enters verification code
   ↓
6. Backend verifies code and creates session
   ↓
7. Admin is logged in (session lasts 12 hours)
```

## Setting Up Admin Users

### Method 1: Using the Script (Recommended)

After database migration, create the first admin user:

```bash
export DATABASE_URL="your_database_url"
npm run create-admin <email> <password> <role>
```

Example:
```bash
npm run create-admin info@aipafgh.org mySecurePassword123 secretariat
```

Roles:
- `secretariat` - Full access to all admin features
- `council` - Read-only access to most features

### Method 2: Via API

Create admin users through the API (requires existing admin session):

```bash
curl -X POST https://your-backend.onrender.com/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: aipaf_admin_session=<your_session_cookie>" \
  -d '{
    "email": "admin@example.com",
    "password": "securePassword123",
    "role": "secretariat"
  }'
```

### Method 3: Direct Database Insert (Advanced)

```sql
INSERT INTO admin_users (email, password_hash, role)
VALUES (
  'admin@example.com',
  'scrypt_hash_here',  -- Generate using the hashPassword function
  'secretariat'
);
```

## Managing Admin Users

### List All Admins

```bash
curl https://your-backend.onrender.com/api/admin/users \
  -H "Cookie: aipaf_admin_session=<your_session_cookie>"
```

### Delete an Admin

```bash
curl -X DELETE "https://your-backend.onrender.com/api/admin/users?id=<admin_id>" \
  -H "Cookie: aipaf_admin_session=<your_session_cookie>"
```

## Security Features

### Password Security
- Passwords are hashed using **scrypt** (memory-hard KDF)
- Salt is generated for each password
- Minimum password length: 8 characters
- Timing-safe comparison prevents timing attacks

### Session Security
- Sessions are cryptographically signed with HMAC-SHA256
- HTTP-only cookies prevent JavaScript access
- Secure flag ensures HTTPS only
- SameSite protection prevents CSRF
- Sessions expire after 12 hours
- Session tokens are base64url encoded

### Email Verification
- 6-digit numeric codes
- Valid for 10 minutes
- Single-use (cleared after verification)
- Prevents unauthorized access even with compromised credentials

### Email Security
- Verification codes sent via SMTP (Zoho Mail)
- Codes are not stored in logs
- Email must be verified on first login
- Supports resend if code expires

## First-Time Setup

### 1. Migrate Database

```bash
export DATABASE_URL="your_render_database_url"
npm run db:migrate
```

This will create the `admin_users` table.

### 2. Create First Admin User

```bash
npm run create-admin info@aipafgh.org yourPassword123 secretariat
```

### 3. Test Login

1. Go to `/admin-login`
2. Enter email: `info@aipafgh.org`
3. Enter password: `yourPassword123`
4. Click "Send verification code"
5. Check email for 6-digit code
6. Enter code and click "Verify and sign in"

### 4. Create Additional Admins

Use the API or script to create additional admin users as needed.

## Role Permissions

### Secretariat (Full Access)
- View and manage all submissions
- Export data
- Mark submissions as handled
- Delete records
- Modify member accounts
- Approve payments
- Create and manage examinations
- Create and manage admin users
- Full audit log access

### Council (Read-Only)
- View all submissions
- Export data
- View member information
- View payment records
- View examination records
- View audit logs
- **Cannot** modify or delete anything
- **Cannot** create admin users

## Troubleshooting

### Verification Code Not Received

1. Check spam/junk folder
2. Verify SMTP configuration in environment variables
3. Check Render logs for email errors
4. Ensure email address is correct
5. Click "Resend code" button

### Verification Code Expired

- Codes expire after 10 minutes
- Click "Resend code" to get a new one
- Old codes cannot be reused

### Invalid Email or Password

- Check email and password are correct
- Ensure admin user exists in database
- Verify email is lowercase (case-insensitive)
- Try creating the admin user again

### Session Issues

- Sessions expire after 12 hours
- Clear browser cookies if stuck
- Try logging in again
- Check if `SESSION_SECRET` is set in environment

### SMTP Configuration Issues

Ensure these environment variables are set:
```text
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=info@aipafgh.org
SMTP_PASS=your_zoho_app_password
EMAIL_FROM=AIPAF Website <info@aipafgh.org>
```

## Migration from API Keys

If you were previously using API keys:

1. **Remove old environment variables:**
   - `ADMIN_SECRETARIAT_KEY`
   - `ADMIN_COUNCIL_KEY`

2. **Create admin users:**
   ```bash
   npm run create-admin <email> <password> <role>
   ```

3. **Inform admins:**
   - Share their new email and password
   - Explain the verification code process
   - Provide this guide

4. **Test the new system:**
   - Log in with each admin account
   - Verify permissions work correctly
   - Check email delivery

## Environment Variables

No special environment variables are required for admin authentication beyond:

- `SESSION_SECRET` - For session signing (already required)
- SMTP variables - For email sending (already required)

## API Endpoints

### POST /api/admin/session
**Actions:**
- `login` - Submit email and password, get verification code
- `verify` - Submit verification code, create session
- `resend` - Resend verification code

### GET /api/admin/session
Check if authenticated and get admin details

### DELETE /api/admin/session
Sign out (clear session)

### GET /api/admin/users
List all admin users (requires secretariat role)

### POST /api/admin/users
Create new admin user (requires secretariat role)

### DELETE /api/admin/users?id=<id>
Delete admin user (requires secretariat role)

## Best Practices

1. **Use strong passwords** - At least 12 characters with mixed case, numbers, and symbols
2. **Limit admin accounts** - Only create accounts for those who need them
3. **Regular audits** - Review admin users periodically
4. **Remove inactive admins** - Delete accounts for staff who left
5. **Use different roles** - Council members get read-only access
6. **Monitor email delivery** - Check that verification codes are sent
7. **Keep SMTP secure** - Use app-specific passwords, not main passwords
8. **Document credentials** - Use a password manager, not spreadsheets

## Support

For issues with:
- **Email delivery**: Check SMTP configuration and Zoho Mail settings
- **Database**: Verify admin_users table exists and has data
- **Sessions**: Check SESSION_SECRET environment variable
- **Login**: Check browser console for errors and network tab for failed requests
