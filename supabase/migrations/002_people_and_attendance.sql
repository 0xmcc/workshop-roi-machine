-- Migration 002: Add people table and field_event_attendance for Luma guest list import
-- 
-- DESIGN RATIONALE:
-- - `people` stores stable identity (matched by email). Same person attending multiple events = one person row.
-- - `field_event_attendance` is a join between people and field_events, capturing per-event metadata.
-- - Idempotency: (field_event_id, luma_api_id) uniqueness prevents duplicate imports.
-- - Raw Luma data stored in JSONB to preserve varying custom columns across events.
-- - Followups remain scoped to attendance (one followup per attendance record).
--
-- INVARIANTS:
-- 1. Each person has exactly one row, identified by email (case-insensitive for matching).
-- 2. Each (person, field_event) pair has at most one attendance record.
-- 3. Each (field_event, luma_api_id) pair has at most one attendance record (idempotent imports).
-- 4. Followups reference attendance_id; the attendance record determines both person and event.

-- =============================================================================
-- PEOPLE TABLE
-- =============================================================================
-- Stable identity for humans who attend field events.
-- Email is the primary deduplication key; luma_api_id is a secondary identifier.

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  
  -- Primary identity (email is the dedup key)
  email text not null,
  
  -- Name fields
  name text,
  first_name text,
  last_name text,
  
  -- Contact
  phone_number text,
  
  -- Crypto addresses (from Luma)
  eth_address text,
  solana_address text,
  
  -- Optional link to authenticated user (future use)
  user_id uuid null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Email uniqueness (case-insensitive via index, case-sensitive constraint as fallback)
  constraint people_email_unique unique (email)
);

-- Case-insensitive email uniqueness for robust deduplication
create unique index if not exists people_email_lower_idx on public.people (lower(email));

alter table public.people disable row level security;

drop trigger if exists people_set_updated_at on public.people;
create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

-- =============================================================================
-- FIELD EVENT ATTENDANCE TABLE
-- =============================================================================
-- Join table between people and field_events.
-- Each row represents one person attending one event.
-- Contains Luma-specific metadata and our local tracking fields.

create table if not exists public.field_event_attendance (
  id uuid primary key default gen_random_uuid(),
  
  -- Foreign keys
  person_id uuid not null references public.people(id) on delete cascade,
  field_event_id text not null references public.field_events(id) on delete cascade,
  
  -- Luma import identifiers (for idempotent re-imports)
  luma_api_id text,
  luma_created_at timestamptz,
  
  -- Luma registration/check-in data
  approval_status text,
  checked_in_at timestamptz,
  
  -- Ticket info
  ticket_type_id text,
  ticket_name text,
  
  -- Payment info
  amount numeric,
  amount_tax numeric,
  amount_discount numeric,
  currency text,
  coupon_code text,
  
  -- Survey responses
  survey_response_rating text,
  survey_response_feedback text,
  
  -- Custom source/tracking
  custom_source text,
  qr_code_url text,
  
  -- Raw Luma row data (preserves all fields including custom questions)
  luma_raw_data jsonb,
  
  -- Our local tracking fields (mirrored from old field_event_attendees for continuity)
  project_name text not null default '',
  status text not null default 'Not Started',
  engagement_score int not null default 0,
  notes text not null default '',
  questions_asked int not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  constraint attendance_status_check
    check (status in ('Shipped', 'In Progress', 'Not Started')),
  constraint attendance_engagement_score_check
    check (engagement_score >= 0 and engagement_score <= 100),
  constraint attendance_questions_asked_check
    check (questions_asked >= 0),
  
  -- INVARIANT: One person can attend each event at most once
  constraint attendance_person_event_unique unique (person_id, field_event_id),
  
  -- INVARIANT: Each Luma guest row (identified by api_id within an event) imports at most once
  constraint attendance_luma_api_id_unique unique (field_event_id, luma_api_id)
);

create index if not exists attendance_person_id_idx on public.field_event_attendance(person_id);
create index if not exists attendance_field_event_id_idx on public.field_event_attendance(field_event_id);
create index if not exists attendance_luma_api_id_idx on public.field_event_attendance(luma_api_id);
create index if not exists attendance_engagement_score_idx on public.field_event_attendance(engagement_score desc);

alter table public.field_event_attendance disable row level security;

drop trigger if exists attendance_set_updated_at on public.field_event_attendance;
create trigger attendance_set_updated_at
before update on public.field_event_attendance
for each row execute function public.set_updated_at();

-- =============================================================================
-- UPDATE FIELD_EVENT_FOLLOWUPS
-- =============================================================================
-- Add attendance_id as the new foreign key (attendance scopes followups).
-- Keep existing columns for backward compatibility during migration.

alter table public.field_event_followups 
  add column if not exists attendance_id uuid references public.field_event_attendance(id) on delete cascade;

create index if not exists followups_attendance_id_idx on public.field_event_followups(attendance_id);

-- Note: The existing attendee_id + field_event_id columns remain for backward compat.
-- New followups created via the attendance-based flow will use attendance_id.
-- Once old data is migrated, those columns can be dropped.

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

comment on table public.people is 'Stable identity for humans who attend field events. Deduplicated by email.';
comment on column public.people.email is 'Primary deduplication key for person identity.';
comment on column public.people.user_id is 'Optional FK to auth.users for linking authenticated accounts.';

comment on table public.field_event_attendance is 'Join between people and field_events. One row per person per event.';
comment on column public.field_event_attendance.luma_api_id is 'Luma guest list api_id for idempotent re-imports.';
comment on column public.field_event_attendance.luma_raw_data is 'Full raw row from Luma CSV including custom question columns.';
comment on column public.field_event_attendance.status is 'Local tracking: Shipped, In Progress, Not Started.';

comment on column public.field_event_followups.attendance_id is 'FK to attendance record. Followups are scoped to a specific attendance.';
