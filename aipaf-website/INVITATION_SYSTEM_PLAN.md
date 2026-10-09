# Member Invitation System - Implementation Plan

## Overview
Implementing a member invitation system based on the "Schedule of Members" document and membership requirements from the Credential specification.

## Components to Implement

### 1. Database Schema ✅
**New Tables:**
- `member_invitations` - Stores invitation records with tokens
- `membership_requirements` - Stores requirements for each membership grade

**Fields:**
- member_invitations: email, full_name, proposed_grade, qualification, affiliation, invitation_token, status, sent_at, accepted_at, expires_at, member_id
- membership_requirements: grade, title, description, requirements, examination_requirements, experience_requirements, cpd_requirements, credential_track

### 2. Invitation Import Script ✅
**File:** `scripts/import-member-invitations.mjs`

**Features:**
- CSV import from Schedule of Members document
- Manual invitation creation
- Token generation (32-byte random)
- 30-day expiration
- Email extraction from affiliation field
- Grade mapping from document to database
- Duplicate detection

**Usage:**
```bash
# Import from CSV
node scripts/import-member-invitations.mjs csv members.csv

# Manual invitation
node scripts/import-member-invitations.mjs manual email@domain.com "Full Name" fellow "PhD" "Affiliation"
```

### 3. Invitation API Handler ✅
**File:** `src/server/handlers/api/member-invitations.mjs`

**Endpoints:**
- `GET /api/member-invitations?action=check&token=xxx` - Check invitation validity
- `POST /api/member-invitations?action=accept` - Accept invitation and create account
- `GET /api/member-invitations?action=list` - List invitations (admin)
- `POST /api/member-invitations?action=send` - Send invitation email (admin)
- `POST /api/member-invitations?action=create` - Create manual invitation (admin)

### 4. Email Template ⏳
**Update:** `src/server/handlers/api/email.mjs`

Add invitation email template with:
- Personalized greeting
- Proposed grade and qualification
- Acceptance link
- Information about AIPAF
- Next steps

### 5. Acceptance Page ⏳
**Create:** `src/pages/accept-invitation.html`

Features:
- Token validation
- Display invitation details (name, grade, qualification)
- Password creation form
- Terms and conditions acceptance
- Success/error messaging

### 6. Membership Requirements Display ⏳
**Update:** Home page membership section

Add:
- Tabbed interface for each grade (Student, Affiliate, Associate, Member, Fellow)
- Requirements for each grade:
  - Academic qualifications
  - Examination requirements
  - Experience requirements
  - CPD requirements
  - Credential track information
- Links to download detailed syllabus documents

### 7. Admin Interface ⏳
**Create:** Admin invitation management page

Features:
- List all invitations with status
- Filter by status (pending, sent, accepted, declined, expired)
- Send invitation emails individually or bulk
- Create manual invitations
- View invitation details
- Resend expired invitations

### 8. Package.json Update ⏳
Add script:
```json
"import:invitations": "node scripts/import-member-invitations.mjs"
```

## Membership Grades and Requirements

Based on the Credential specification:

### Fellow (FAIPAF)
- **Basis:** Professorial rank or equivalent standing
- **Requirements:** Teaching, examining or senior practice in project assurance and forensics
- **Experience:** Established senior practice
- **Examinations:** Foundation + any track + Chartered assessment

### Member (MAIPAF)
- **Basis:** Doctoral qualification or AIPAF credential
- **Requirements:** Established practice in the profession
- **Experience:** Relevant practical experience
- **Examinations:** Foundation + any track

### Associate (AAIPAF)
- **Basis:** Practising in the profession
- **Requirements:** Pending assessment of qualification
- **Experience:** Practical experience in domain
- **Examinations:** Foundation + track (pending full grade)

### Affiliate
- **Basis:** Qualified in adjacent discipline
- **Requirements:** Engagement with AIPAF work
- **Experience:** None initially
- **Examinations:** Optional

### Graduate
- **Basis:** Doctoral candidates and early career researchers
- **Requirements:** In training
- **Experience:** None (in training)
- **Examinations:** None (in training)

### Student
- **Basis:** Undergraduate students
- **Requirements:** Enrolled in relevant programme
- **Experience:** None
- **Examinations:** None

## Credential Tracks

### CPMP (Certified Project Management Practitioner)
- **Domain:** Delivery
- **Examinations:** Foundation + P1 + P2 + Competency Assessment
- **Experience:** Relevant delivery experience
- **Focus:** African delivery conditions, governance-ready delivery

### CPAP (Certified Project Assurance Practitioner)
- **Domain:** Assurance
- **Examinations:** Foundation + P1 + P2 + Competency Assessment
- **Experience:** Independent assurance experience
- **Focus:** Independent oversight, deliverability assessment

### CPFE (Certified Project Forensic Examiner)
- **Domain:** Forensics
- **Examinations:** Foundation + P1 + P2 + Competency Assessment
- **Experience:** Forensic investigation experience
- **Focus:** Failure analysis, delay analysis, quantum assessment

## Invitation Flow

1. **Import Phase**
   - Import members from Schedule of Members CSV
   - System generates unique invitation tokens
   - Sets 30-day expiration
   - Maps document classes to database grades

2. **Sending Phase**
   - Admin reviews invitations (optional)
   - Admin sends invitation emails
   - Email contains personalized acceptance link
   - Status changes from pending → sent

3. **Acceptance Phase**
   - User clicks acceptance link
   - System validates token and expiration
   - User creates password
   - System creates member account
   - Sets membership grade from invitation
   - Sets membership status to active
   - Marks email as verified
   - Creates session and logs in user
   - Invitation status changes to accepted

4. **Post-Acceptance**
   - User can access member dashboard
   - User can complete profile
   - User can view grade-specific requirements
   - User can pursue credential tracks

## Security Features

- Token-based invitations (32-byte random)
- 30-day expiration
- Single-use tokens
- Email verification required
- Duplicate detection
- Admin-only sending
- Status tracking throughout process

## Implementation Status

✅ Database schema updated
✅ Import script created
✅ API handler created
✅ Router updated
✅ Email template added
✅ Acceptance page created
✅ Membership requirements display added to home page
✅ Admin interface created
✅ Package.json updated
✅ CSV template created
✅ Testing guide created

## Next Steps

All implementation tasks are complete. The system is ready for:

1. **Prepare Schedule of Members CSV**
   - Use the template at `scripts/schedule-of-members-template.csv`
   - Extract data from the Schedule of Members document
   - Ensure email addresses are included in the affiliation field
   - See `scripts/INVITATION_IMPORT_README.md` for detailed instructions

2. **Import invitations**
   ```bash
   npm run import:invitations csv path/to/members.csv
   ```

3. **Test the flow**
   - Follow the testing guide at `scripts/INVITATION_TESTING_GUIDE.md`
   - Verify import, admin interface, and acceptance flow
   - Test email sending if RESEND_API_KEY is configured

4. **Deploy to production**
   - Set up production DATABASE_URL
   - Configure RESEND_API_KEY for email sending
   - Set SITE_URL to production domain
   - Run database migrations
   - Import real member data

5. **Train Secretariat**
   - Share INVITATION_IMPORT_README.md
   - Demonstrate admin interface
   - Explain invitation workflow
   - Provide troubleshooting guide
