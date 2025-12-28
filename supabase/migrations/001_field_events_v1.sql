-- v1 schema for field events + attendees + follow-ups.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.field_events (
  id text primary key,
  title text not null,
  date text not null,
  venue text not null,
  topic text not null,
  conversion_goal text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.field_events disable row level security;

create table if not exists public.field_event_attendees (
  id text primary key,
  field_event_id text not null references public.field_events(id) on delete cascade,
  name text not null,
  email text not null,
  project_name text not null,
  status text not null,
  engagement_score int not null,
  notes text not null default '',
  questions_asked int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_event_attendees_status_check
    check (status in ('Shipped', 'In Progress', 'Not Started')),
  constraint field_event_attendees_engagement_score_check
    check (engagement_score >= 0 and engagement_score <= 100),
  constraint field_event_attendees_questions_asked_check
    check (questions_asked >= 0)
);

alter table public.field_event_attendees disable row level security;

create index if not exists field_event_attendees_field_event_id_idx
  on public.field_event_attendees(field_event_id);

create table if not exists public.field_event_followups (
  id uuid primary key default gen_random_uuid(),
  field_event_id text not null references public.field_events(id) on delete cascade,
  attendee_id text not null references public.field_event_attendees(id) on delete cascade,
  attendee_email text not null,
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz null,
  constraint field_event_followups_unique_per_attendee unique (field_event_id, attendee_id),
  constraint field_event_followups_status_check check (status in ('draft', 'sent')),
  constraint field_event_followups_sent_at_consistency check (
    (status = 'sent' and sent_at is not null)
    or
    (status = 'draft' and sent_at is null)
  )
);

alter table public.field_event_followups disable row level security;

create index if not exists field_event_followups_field_event_id_idx
  on public.field_event_followups(field_event_id);

create index if not exists field_event_followups_attendee_id_idx
  on public.field_event_followups(attendee_id);

drop trigger if exists field_events_set_updated_at on public.field_events;
create trigger field_events_set_updated_at
before update on public.field_events
for each row execute function public.set_updated_at();

drop trigger if exists field_event_attendees_set_updated_at on public.field_event_attendees;
create trigger field_event_attendees_set_updated_at
before update on public.field_event_attendees
for each row execute function public.set_updated_at();

drop trigger if exists field_event_followups_set_updated_at on public.field_event_followups;
create trigger field_event_followups_set_updated_at
before update on public.field_event_followups
for each row execute function public.set_updated_at();

