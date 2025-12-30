import { getSupabaseClient } from '../supabaseClient';
import type { FieldEvent, FieldEventSummary } from '../../types';

type FieldEventRow = {
  id: string;
  title: string;
  date: string;
  venue: string;
  topic: string;
  conversion_goal: string;
};

export interface CreateFieldEventInput {
  title: string;
  date: string;
  venue?: string;
  topic?: string;
  conversionGoal?: string;
}

export const fieldEventsRepo = {
  /**
   * Create a new field event.
   */
  async create(input: CreateFieldEventInput): Promise<FieldEvent> {
    const supabase = getSupabaseClient();
    
    // Generate a slug-based ID from title and date
    const id = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${input.date}`.substring(0, 50);

    const { data, error } = await supabase
      .from('field_events')
      .insert({
        id,
        title: input.title,
        date: input.date,
        venue: input.venue || 'TBD',
        topic: input.topic || 'General',
        conversion_goal: input.conversionGoal || 'Engagement'
      })
      .select('*')
      .single();

    if (error) throw error;

    const row = data as FieldEventRow;
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      venue: row.venue,
      topic: row.topic,
      conversionGoal: row.conversion_goal
    };
  },

  /**
   * Get a single field event by ID with attendee count.
   */
  async getById(id: string): Promise<FieldEventSummary | null> {
    const supabase = getSupabaseClient();

    const { data: event, error: eventError } = await supabase
      .from('field_events')
      .select('id,title,date,venue,topic,conversion_goal')
      .eq('id', id)
      .single();

    if (eventError) {
      if (eventError.code === 'PGRST116') return null; // Not found
      throw eventError;
    }
    if (!event) return null;

    // Fetch attendee count
    const { count, error: countError } = await supabase
      .from('field_event_attendance')
      .select('*', { count: 'exact', head: true })
      .eq('field_event_id', id);

    if (countError) throw countError;

    const row = event as FieldEventRow;
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      venue: row.venue,
      topic: row.topic,
      conversionGoal: row.conversion_goal,
      attendeeCount: count ?? 0
    };
  },

  async listSummaries(): Promise<FieldEventSummary[]> {
    const supabase = getSupabaseClient();

    // Fetch events
    const { data: events, error: eventsError } = await supabase
      .from('field_events')
      .select('id,title,date,venue,topic,conversion_goal')
      .order('date', { ascending: false });

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) return [];

    // Fetch attendee counts from new field_event_attendance table
    const eventIds = events.map((e) => e.id);
    const { data: counts, error: countsError } = await supabase
      .from('field_event_attendance')
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

