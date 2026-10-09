# Member Invitation Import System

## Overview

This system allows the Secretariat to import member invitations from the Schedule of Members document and manage the invitation flow.

## CSV Format

The CSV file must have the following columns (header row required):

```
No,Full name,Professional qualification,Class,Institutional affiliation and address for service,Source,Consent,In coverage
```

### Column Descriptions

- **No**: Sequential number (optional, for reference)
- **Full name**: Complete name of the invitee (required)
- **Professional qualification**: Highest qualification (e.g., PhD, MSc, BSc) (optional)
- **Class**: Membership class from Schedule of Members (required)
  - Valid values: Fellow, Member, Associate, Affiliate, Honorary Fellow, Student
  - Maps to database grades: fellow, member, associate, affiliate, student
- **Institutional affiliation and address for service**: Must include email address (required)
  - Email can be anywhere in this field
  - System extracts email using regex pattern
- **Source**: Source of the invitation (e.g., "Schedule of Members") (optional)
- **Consent**: Consent indicator (optional, for record-keeping)
- **In coverage**: Coverage indicator (optional, for record-keeping)

### Example Row

```
1,Dr. Kwame Mensah,PhD in Project Management,Fellow,University of Ghana, Department of Building Technology, Legon, Accra, Ghana. Email: kwame.mensah@ug.edu.gh,Schedule of Members,Yes,Yes
```

## Usage

### Import from CSV

```bash
npm run import:invitations csv path/to/members.csv
```

The script will:
- Parse the CSV file
- Extract email addresses from the affiliation field
- Map document classes to database grades
- Generate unique invitation tokens (32-byte random)
- Set 30-day expiration
- Skip duplicates (existing invitations for the same email)
- Display import summary

### Create Manual Invitation

```bash
npm run import:invitations manual <email> <fullName> <grade> <qualification> <affiliation>
```

Example:
```bash
npm run import:invitations manual john@example.com "John Doe" fellow "PhD" "University of Ghana"
```

Valid grades: fellow, member, associate, affiliate, student

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string

Optional:
- `SITE_URL`: Base URL for acceptance links (default: http://localhost:3000)

## Invitation Flow

1. **Import Phase**
   - Run import script to create invitation records
   - Tokens are generated and stored
   - Status set to "pending"
   - 30-day expiration set

2. **Sending Phase** (via Admin Interface)
   - Secretariat logs into admin panel
   - Navigate to "Member invitations" section
   - Filter by status (pending, sent, accepted, etc.)
   - Click "Send email" button for individual invitations
   - Status changes from "pending" → "sent"
   - Email sent with acceptance link

3. **Acceptance Phase** (by Invitee)
   - Invitee clicks link in email
   - Opens `/accept-invitation?token=xxx`
   - System validates token and expiration
   - Invitee creates password
   - Account created with member grade
   - Email marked as verified
   - Session created and user logged in
   - Redirected to member profile
   - Status changes to "accepted"

## Admin Interface

Access via `/admin` (requires Secretariat credentials)

Features:
- List all invitations with status
- Filter by status (pending, sent, accepted, declined, expired)
- Send invitation emails individually
- Create manual invitations
- View invitation details

## Grade Mapping

| Document Class | Database Grade |
|----------------|----------------|
| Fellow | fellow |
| Member | member |
| Associate | associate |
| Affiliate | affiliate |
| Honorary Fellow | fellow |
| Student | student |

## Security Features

- Token-based invitations (32-byte random)
- 30-day expiration
- Single-use tokens
- Email verification required
- Duplicate detection
- Secretariat-only sending
- Status tracking throughout process

## Troubleshooting

### Import fails with "no email found"
- Ensure the affiliation field contains a valid email address
- Email format: user@domain.tld
- Check for typos in email addresses

### Invitation already exists
- The email address already has an invitation in the database
- Check existing invitations in admin panel
- Delete or update existing invitation if needed

### Email sending fails
- Check `RESEND_API_KEY` environment variable
- Verify Resend API is accessible
- Check email deliverability settings

## Sample Files

- `schedule-of-members-template.csv`: Sample CSV with correct format
- Use this as a template when preparing data from Schedule of Members document

## Next Steps After Import

1. Review imported invitations in admin panel
2. Send invitation emails to pending invitations
3. Monitor acceptance status
4. Follow up with non-responding invitees
5. Resend expired invitations if needed
