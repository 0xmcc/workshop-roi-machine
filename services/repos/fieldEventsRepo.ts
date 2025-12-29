import { getSupabaseClient } from '../supabaseClient';
import type { FieldEventSummary } from '../../types';

type FieldEventRow = {
  id: string;
  title: string;
  date: string;
  venue: string;
  topic: string;
  conversion_goal: string;
};

export const fieldEventsRepo = {
  async listSummaries(): Promise<FieldEventSummary[]> {
    const supabase = getSupabaseClient();

    // Fetch events
    const { data: events, error: eventsError } = await supabase
      .from('field_events')
      .select('id,title,date,venue,topic,conversion_goal')
      .order('date', { ascending: false });

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) return [];

    // Fetch attendee counts separately (avoids PostgREST relationship cache issues)
    const eventIds = events.map((e) => e.id);
    const { data: counts, error: countsError } = await supabase
      .from('field_event_attendees')
      .select('field_event_id')
      .in('field_event_id', eventIds);

    if (countsError) throw countsError;

    // Count attendees per event
    const countMap = new Map<string, number>();
    for (const row of counts ?? []) {
      const current = countMap.get(row.field_event_id) ?? 0;
      countMap.set(row.field_event_id, current + 1);
    }

    return (events as FieldEventRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      date: row.date,
      venue: row.venue,
      topic: row.topic,
      conversionGoal: row.conversion_goal,
      attendeeCount: countMap.get(row.id) ?? 0
    }));
  }
};

