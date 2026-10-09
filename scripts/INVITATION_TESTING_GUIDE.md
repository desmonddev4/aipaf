# Member Invitation System - Testing Guide

## Prerequisites

Before testing, ensure:

1. **Database is running and accessible**
   ```bash
   # Check DATABASE_URL is set
   echo $DATABASE_URL
   ```

2. **Environment variables configured**
   - `DATABASE_URL`: PostgreSQL connection string
   - `RESEND_API_KEY`: For email sending (optional for testing without email)
   - `SITE_URL`: Base URL for acceptance links (default: http://localhost:3000)
   - `EMAIL_FROM`: Sender email address (default: noreply@aipaf.africa)

3. **Database schema includes invitation tables**
   ```bash
   npm run db:migrate
   ```

4. **Development server running**
   ```bash
   npm run dev
   ```

## Test 1: CSV Import

### Step 1: Prepare test CSV

Create a test CSV file `test-invitations.csv`:

```csv
No,Full name,Professional qualification,Class,Institutional affiliation and address for service,Source,Consent,In coverage
1,Test User One,BSc Computer Science,Member,Test Company Ltd, Accra, Ghana. Email: test1@example.com,Test,Yes,Yes
2,Test User Two,MSc Project Management,Associate,Test University, Kumasi, Ghana. Email: test2@example.com,Test,Yes,Yes
3,Test User Three,PhD Engineering,Fellow,Test Institute, Lagos, Nigeria. Email: test3@example.com,Test,Yes,Yes
```

### Step 2: Run import

```bash
npm run import:invitations csv test-invitations.csv
```

### Expected Output:
```
Found 3 entries to import
✓ Imported 1: Test User One (member)
✓ Imported 2: Test User Two (associate)
✓ Imported 3: Test User Three (fellow)

=== Import Summary ===
Imported: 3
Skipped: 0
Errors: 0
Total processed: 3
```

### Verification:

```sql
-- Check database
SELECT id, email, full_name, proposed_grade, status, expires_at
FROM member_invitations
ORDER BY created_at DESC
LIMIT 5;
```

Expected:
- 3 rows with status 'pending'
- Valid invitation tokens
- expires_at set to 30 days from now

## Test 2: Manual Invitation Creation

### Step 1: Create manual invitation

```bash
npm run import:invitations manual manual@example.com "Manual User" affiliate "BSc" "Test Org"
```

### Expected Output:
```
✓ Created invitation for Manual User (affiliate)
   Token: [64-character hex string]
   Acceptance URL: http://localhost:3000/accept-invitation?token=[token]
```

### Verification:

```sql
SELECT * FROM member_invitations WHERE email = 'manual@example.com';
```

## Test 3: Admin Interface

### Step 1: Access admin panel

1. Navigate to `http://localhost:3000/admin`
2. Log in with Secretariat credentials

### Step 2: Test invitation listing

1. Select "Member invitations" from dropdown
2. Verify table shows imported invitations
3. Check status filter works (pending, sent, accepted, etc.)

### Step 3: Test sending invitation email

1. Find a pending invitation
2. Click "Send email" button
3. Verify status changes to "sent"
4. Check console for email logs (if RESEND_API_KEY not configured)

### Step 4: Test manual invitation creation

1. Click "Create manual invitation" button
2. Enter test details via prompts
3. Verify invitation appears in list

## Test 4: Invitation Acceptance Flow

### Step 1: Get invitation token

```sql
SELECT invitation_token, email, full_name, proposed_grade
FROM member_invitations
WHERE status = 'pending'
LIMIT 1;
```

### Step 2: Test check endpoint

```bash
curl "http://localhost:3000/api/member-invitations?action=check&token=[token]"
```

Expected response:
```json
{
  "ok": true,
  "invitation": {
    "fullName": "Test User One",
    "grade": "member",
    "qualification": "BSc Computer Science"
  }
}
```

### Step 3: Test acceptance page

1. Open browser to `http://localhost:3000/accept-invitation?token=[token]`
2. Verify page loads without errors
3. Check invitation details are displayed correctly
4. Verify grade and qualification shown

### Step 4: Test password creation

1. Enter password (min 12 characters)
2. Confirm password
3. Accept terms checkbox
4. Click "Accept Invitation & Create Account"

### Expected Behavior:
- Form submits successfully
- "Account created successfully" message appears
- Redirect to `/member-profile` after 2 seconds
- Session cookie set

### Step 5: Verify account creation

```sql
SELECT id, email, first_name, last_name, membership_grade, membership_status, email_verified
FROM members
WHERE email = 'test1@example.com';
```

Expected:
- Member account created
- Grade matches invitation
- Status is 'active'
- email_verified is TRUE

### Step 6: Verify invitation status

```sql
SELECT status, accepted_at, member_id
FROM member_invitations
WHERE email = 'test1@example.com';
```

Expected:
- status is 'accepted'
- accepted_at is set
- member_id links to created member

## Test 5: Error Cases

### Test 5.1: Invalid token

```bash
curl "http://localhost:3000/api/member-invitations?action=check&token=invalid"
```

Expected: `{"ok": false, "message": "Invalid invitation token."}`

### Test 5.2: Expired invitation

```sql
UPDATE member_invitations
SET expires_at = NOW() - INTERVAL '1 day'
WHERE email = 'test2@example.com';
```

Then test check endpoint with that token.

Expected: `{"ok": false, "message": "This invitation has expired."}`

### Test 5.3: Already accepted

Accept an invitation, then try to accept again.

Expected: `{"ok": false, "message": "This invitation has already been accepted."}`

### Test 5.4: Duplicate email on import

Try importing the same CSV twice.

Expected: Second import skips existing emails.

### Test 5.5: Password too short

Enter password < 12 characters on acceptance page.

Expected: Error message "Password must be at least 12 characters."

### Test 5.6: Passwords don't match

Enter different passwords in password and confirm fields.

Expected: Error message "Passwords do not match."

## Test 6: Email Sending (with RESEND_API_KEY)

If RESEND_API_KEY is configured:

### Step 1: Send invitation from admin

1. Click "Send email" button
2. Check email inbox for test user
3. Verify email content includes:
   - Personalized greeting
   - Proposed grade
   - Acceptance link
   - Information about AIPAF

### Step 2: Test acceptance from email link

1. Click link in email
2. Complete acceptance flow
3. Verify everything works

## Test 7: Security Features

### Test 7.1: Token uniqueness

Import multiple invitations and verify all tokens are unique.

```sql
SELECT COUNT(DISTINCT invitation_token), COUNT(*)
FROM member_invitations;
```

Expected: Both counts should be equal.

### Test 7.2: Expiration enforcement

Set expires_at to past, verify acceptance fails.

### Test 7.3: Single-use tokens

Accept an invitation, then try to accept again with same token.

Expected: Fails with "already accepted" message.

### Test 7.4: Admin-only sending

Try calling send endpoint without admin session.

Expected: 403 Forbidden

## Cleanup

After testing, clean up test data:

```sql
-- Delete test members
DELETE FROM members WHERE email LIKE '%@example.com';

-- Delete test invitations
DELETE FROM member_invitations WHERE email LIKE '%@example.com';
```

## Automation Script

Create `test-invitation-flow.sh`:

```bash
#!/bin/bash
set -e

echo "=== Testing Invitation System ==="

# Test 1: Import
echo "Test 1: CSV Import"
npm run import:invitations csv test-invitations.csv

# Test 2: Check endpoint
echo "Test 2: Check endpoint"
TOKEN=$(psql $DATABASE_URL -t -c "SELECT invitation_token FROM member_invitations WHERE email='test1@example.com' LIMIT 1;")
curl "http://localhost:3000/api/member-invitations?action=check&token=$TOKEN"

# Test 3: Manual creation
echo "Test 3: Manual invitation"
npm run import:invitations manual auto@example.com "Auto User" affiliate "BSc" "Auto Org"

echo "=== Tests Complete ==="
```

## Known Limitations

1. **Email testing**: Without RESEND_API_KEY, emails are skipped (logged to console)
2. **Schedule of Members conversion**: .docx to CSV requires manual conversion or external tool
3. **Bulk email sending**: Currently only individual sending from admin panel

## Success Criteria

All tests pass if:
- ✅ CSV import creates invitations correctly
- ✅ Manual invitation creation works
- ✅ Admin interface lists and manages invitations
- ✅ Check endpoint validates tokens
- ✅ Acceptance page loads and displays details
- ✅ Password creation creates member account
- ✅ Session is created and user logged in
- ✅ Invitation status updates to accepted
- ✅ Error cases handle gracefully
- ✅ Security features enforce correctly
