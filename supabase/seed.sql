-- Seed data (from the original prototype mocks).
-- Safe to re-run: events/attendees upsert by id, followups are insert-once.

insert into public.field_events (id, title, date, venue, topic, conversion_goal)
values
  ('w1', 'AI Product Builder Masterclass', '2024-05-15', 'Google Campus / SF', 'Building MVPs with Gemini API', 'Annual Pro Membership ($299)'),
  ('w2', 'Modern React Frameworks', '2024-05-10', 'Corporate Office / Austin', 'Next.js 14 and Server Components', 'Team Training Package ($4,999)')
on conflict (id) do update
set
  title = excluded.title,
  date = excluded.date,
  venue = excluded.venue,
  topic = excluded.topic,
  conversion_goal = excluded.conversion_goal;

insert into public.field_event_attendees (
  id,
  field_event_id,
  name,
  email,
  project_name,
  status,
  engagement_score,
  notes,
  questions_asked
)
values
  ('a1', 'w1', 'Sarah Chen', 'sarah@example.com', 'Smart CRM Integration', 'Shipped', 95, 'Highly engaged, asked about enterprise pricing.', 5),
  ('a2', 'w1', 'Marcus Thorne', 'marcus@devs.io', 'Voice Assistant for Seniors', 'In Progress', 65, 'Struggling with audio latency.', 2),
  ('a3', 'w1', 'Elena Rodriguez', 'elena@startup.co', 'Eco-Tracker Dashboard', 'Shipped', 88, 'Already shared the project on LinkedIn.', 1),
  ('a4', 'w2', 'David Kim', 'david.k@corp.com', 'Internal Analytics Portal', 'In Progress', 40, 'Needs more help with cache revalidation.', 0)
on conflict (id) do update
set
  field_event_id = excluded.field_event_id,
  name = excluded.name,
  email = excluded.email,
  project_name = excluded.project_name,
  status = excluded.status,
  engagement_score = excluded.engagement_score,
  notes = excluded.notes,
  questions_asked = excluded.questions_asked;

-- Seed “sent” followups for the two attendees that had follow-up sent in the prototype.
insert into public.field_event_followups (
  field_event_id,
  attendee_id,
  attendee_email,
  subject,
  body,
  status,
  sent_at
)
values
  (
    'w1',
    'a1',
    'sarah@example.com',
    'Following up from AI Product Builder Masterclass',
    'Hi Sarah — great meeting you at the masterclass. Congrats on shipping Smart CRM Integration. If you want, I can share a couple enterprise-pricing tactics we see work well. Reply with your preferred next step and timeline.',
    'sent',
    now()
  ),
  (
    'w1',
    'a3',
    'elena@startup.co',
    'Following up from AI Product Builder Masterclass',
    'Hi Elena — awesome work shipping Eco-Tracker Dashboard, and thanks for sharing it publicly. If you’re open to it, I’d love to help you turn the momentum into a repeatable workflow. Want a quick 15-minute follow-up?',
    'sent',
    now()
  )
on conflict (field_event_id, attendee_id) do nothing;

