# Workshop ROI Machine (v1 with Supabase)

This v1 stores **field events**, **attendees**, and **follow-ups** in Supabase so the app reloads to the same state (draft/sent), and dashboard metrics are derived from real data.

## Prerequisites

- Node.js
- A Supabase project (no auth/RLS required for this single-user v1)

## Supabase setup (schema + seed)

1. In your Supabase project, open **SQL Editor**.
2. Run the migration:
   - `supabase/migrations/001_field_events_v1.sql`
3. Run the seed:
   - `supabase/seed.sql`

## Environment variables

Create a `.env.local` file (or use your preferred Vite env file) with:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Preview deployments may instead provide:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

Tip: copy `.env.example` to `.env.local`.

## Run locally

```bash
npm install
npm run build
npm run preview
```

