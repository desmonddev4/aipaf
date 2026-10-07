# AIPAF backend: to-do list

The website is frontend only. Everything below is the work left for the backend. Items are in a sensible build order. Places in the code that already expect the backend are marked `TODO(backend)`.

## 1. Forms (needed before launch)

- [ ] **Contact form endpoint** (`POST /api/contact`). Fields sent by the page: `name`, `email`, `topic`, `message`, plus `_elapsedMs` and `_page`.
- [ ] **Founding membership interest endpoint** (`POST /api/membership-interest`). Fields: `name`, `email`, `organisation`, `country`, `registering_as`, `area_of_practice`, `message`, plus `_elapsedMs` and `_page`.
- [ ] Validate and sanitise every field on the server. The browser checks are for convenience only.
- [ ] Spam protection. The forms already send a hidden honeypot (`website`, must be empty, so reject if filled) and `_elapsedMs` (reject submissions made in under about 2 seconds). Add rate limiting per IP, and consider Cloudflare Turnstile or reCAPTCHA.
- [ ] Send a notification email to the Secretariat and an acknowledgement email to the sender. Pick a transactional email provider (Resend, Postmark, SendGrid, or SES).
- [ ] Store each submission in a database table so nothing is lost if an email fails.
- [ ] Return `200` with JSON on success and a non-200 status on failure. The frontend shows a thank-you message on `ok` and an error message otherwise.
- [ ] Then switch the forms on: put the endpoint paths in `public/js/config.js` (`ENDPOINTS.contact`, `ENDPOINTS.membership`). Until then the forms open the visitor's email app, addressed to `CONTACT_EMAIL`.
- [ ] Replace the placeholder address `info@aipaf.africa` with the Institute's real address in `public/js/config.js` and `src/pages/contact.html`.

Suggested approach on Vercel: add an `api/` folder with serverless functions, or use a separate API service and set the endpoints to its full URL (then allow the site's origin with CORS).

## 2. Data and admin

- [ ] Database (Postgres on Neon/Supabase/Vercel Postgres is a good fit). Tables: `contact_messages`, `membership_interests`, later `members`.
- [ ] A simple protected admin area for the Secretariat to read, filter, export (CSV) and mark submissions as handled.
- [ ] Admin authentication with roles (Secretariat, Council).
- [ ] Data protection: a privacy notice page, consent wording on the forms, a retention rule, and a process for deletion requests (Ghana Data Protection Act, 2012).

## 3. Membership and credentials (later phases)

- [ ] Member accounts: sign up, sign in, password reset, profile.
- [ ] Membership application flow per grade (Student, Affiliate, Associate, Member, Fellow) with document upload and Secretariat review.
- [ ] Payments for subscriptions and examination fees (Paystack or Flutterwave suit Ghana and pan-African cards and mobile money).
- [ ] Examination registration and results records.
- [ ] CPD logging and annual compliance tracking for certified members.
- [ ] **Public register of members** (the profile commits to one): searchable by name, designation and grade, with a verification page for employers and courts.
- [ ] Certificate generation with a verification code or QR link.

## 4. Content management

- [ ] Move page copy into a CMS (Sanity, Contentful, Strapi, or Markdown in the repo) so the Secretariat can edit text without a developer.
- [ ] News, research and publications section (Research and Publications Committee).
- [ ] Downloads: Organisational Profile, Credential Specification and Constitution once they are approved for publication, linked from the footer.
- [ ] Events and CPD calendar.

## 5. Operations and launch checklist

- [ ] Connect the domain in Vercel and set the `SITE_URL` environment variable so the canonical links, `sitemap.xml` and `robots.txt` use the real domain. (It defaults to `https://aipaf.africa`.)
- [ ] Add analytics (Plausible, Fathom, or GA4) with a cookie notice if required.
- [ ] Add error monitoring (Sentry) and uptime monitoring.
- [ ] Add a proper Open Graph share image (1200 x 630) and reference it in `src/partials/layout.html`.
- [ ] Set up email DNS records (SPF, DKIM, DMARC) for the domain so Secretariat emails are not marked as spam.
- [ ] Backups for the database and a staging environment (Vercel preview deployments already give you one per branch).
- [ ] Security review: secrets only in Vercel environment variables, never in the repo.
