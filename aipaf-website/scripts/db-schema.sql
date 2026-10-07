CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  page TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_interests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organisation TEXT,
  country TEXT NOT NULL,
  registering_as TEXT NOT NULL,
  area_of_practice TEXT,
  message TEXT,
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  page TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country TEXT,
  organisation TEXT,
  designation TEXT,
  membership_grade TEXT NOT NULL DEFAULT 'affiliate' CHECK (membership_grade IN ('student', 'affiliate', 'associate', 'member', 'fellow')),
  membership_status TEXT NOT NULL DEFAULT 'unverified' CHECK (membership_status IN ('unverified', 'pending', 'active', 'suspended', 'expired')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'secretariat', 'council')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile_public BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_profiles (
  member_id UUID PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  bio TEXT,
  phone TEXT,
  website TEXT,
  linked_in TEXT,
  public_email TEXT,
  preferred_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS member_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  grade TEXT NOT NULL CHECK (grade IN ('student', 'affiliate', 'associate', 'member', 'fellow')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn')),
  submission_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewer_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'GHS',
  purpose TEXT NOT NULL CHECK (purpose IN ('membership', 'examination', 'subscription', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'paid', 'failed', 'refunded', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS examinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS examination_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'paid', 'confirmed', 'cancelled', 'completed')),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  result_score NUMERIC(5,2),
  result_status TEXT CHECK (result_status IN ('pass', 'fail', 'pending', 'withheld')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, member_id)
);

CREATE TABLE IF NOT EXISTS cpd_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('education', 'practice', 'research', 'service', 'other')),
  title TEXT NOT NULL,
  provider TEXT,
  completion_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0),
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('student', 'affiliate', 'associate', 'member', 'fellow')),
  issuer TEXT NOT NULL DEFAULT 'AIPAF',
  issued_at DATE NOT NULL,
  expires_at DATE,
  type TEXT NOT NULL CHECK (type IN ('professional', 'exam', 'cpd')),
  verification_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('page', 'news', 'publication', 'event', 'download')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  author_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS membership_interests_created_at_idx ON membership_interests (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_handled_at_idx ON contact_messages (handled_at);
CREATE INDEX IF NOT EXISTS membership_interests_handled_at_idx ON membership_interests (handled_at);
CREATE INDEX IF NOT EXISTS members_email_idx ON members (email);
CREATE INDEX IF NOT EXISTS members_grade_status_idx ON members (membership_grade, membership_status);
CREATE INDEX IF NOT EXISTS member_applications_status_idx ON member_applications (status);
CREATE INDEX IF NOT EXISTS payments_member_idx ON payments (member_id, status);
CREATE INDEX IF NOT EXISTS examination_registrations_member_idx ON examination_registrations (member_id, status);
CREATE INDEX IF NOT EXISTS cpd_records_member_idx ON cpd_records (member_id, completion_date DESC);
CREATE INDEX IF NOT EXISTS cms_content_type_status_idx ON cms_content (type, status, published_at DESC);
