import { getSupabaseClient } from '../supabaseClient';
import type { FieldEventSummary } from '../../types';

type FieldEventRow = {
  id: string;
  title: string;
  date: string;
  venue: string;
  topic: string;
  conversion_goal: string;
  field_event_attendees?: Array<{ count: number }>;
};

export const fieldEventsRepo = {
  async listSummaries(): Promise<FieldEventSummary[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_events')
      .select('id,title,date,venue,topic,conversion_goal,field_event_attendees(count)')
      .order('date', { ascending: false });

    if (error) throw error;

    return (data as FieldEventRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      date: row.date,
      venue: row.venue,
      topic: row.topic,
      conversionGoal: row.conversion_goal,
      attendeeCount: row.field_event_attendees?.[0]?.count ?? 0
    }));
  }
};

