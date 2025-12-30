import { getSupabaseClient } from '../supabaseClient';
import type { FieldEventAttendee } from '../../types';

/**
 * Attendees repository - queries from the NEW field_event_attendance + people tables
 * but returns data in the legacy FieldEventAttendee shape for backward compatibility.
 */

type AttendanceWithPersonRow = {
  id: string;
  field_event_id: string;
  person_id: string;
  project_name: string;
  status: string;
  engagement_score: number;
  notes: string;
  questions_asked: number;
  people: {
    id: string;
    email: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
};

function getDisplayName(person: AttendanceWithPersonRow['people']): string {
  if (person.name) return person.name;
  if (person.first_name || person.last_name) {
    return [person.first_name, person.last_name].filter(Boolean).join(' ');
  }
  return person.email.split('@')[0];
}

export const attendeesRepo = {
  /**
   * List attendees for a field event.
   * Queries from field_event_attendance joined with people.
   */
  async listByFieldEventId(fieldEventId: string): Promise<FieldEventAttendee[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendance')
      .select(`
        id,
        field_event_id,
        person_id,
        project_name,
        status,
        engagement_score,
        notes,
        questions_asked,
        people (
          id,
          email,
          name,
          first_name,
          last_name
        )
      `)
      .eq('field_event_id', fieldEventId)
      .order('engagement_score', { ascending: false });

    if (error) throw error;

    return (data as unknown as AttendanceWithPersonRow[]).map((row) => ({
      id: row.id,
      fieldEventId: row.field_event_id,
      name: getDisplayName(row.people),
      email: row.people.email,
      projectName: row.project_name || '',
      status: row.status as FieldEventAttendee['status'],
      engagementScore: row.engagement_score,
      notes: row.notes || '',
      questionsAsked: row.questions_asked
    }));
  },

  /**
   * List hot leads (high engagement score) across all events.
   * Queries from field_event_attendance joined with people and field_events.
   */
  async listHotLeads(limit: number): Promise<Array<FieldEventAttendee & { fieldEventTitle: string }>> {
    const supabase = getSupabaseClient();

    // Fetch hot leads from attendance table
    const { data: attendances, error: attendancesError } = await supabase
      .from('field_event_attendance')
      .select(`
        id,
        field_event_id,
        person_id,
        project_name,
        status,
        engagement_score,
        notes,
        questions_asked,
        people (
          id,
          email,
          name,
          first_name,
          last_name
        )
      `)
      .gte('engagement_score', 85)
      .order('engagement_score', { ascending: false })
      .limit(limit);

    if (attendancesError) throw attendancesError;
    if (!attendances || attendances.length === 0) return [];

    // Fetch event titles separately
    const eventIds = [...new Set(attendances.map((a) => a.field_event_id))];
    const { data: events, error: eventsError } = await supabase
      .from('field_events')
      .select('id,title')
      .in('id', eventIds);

    if (eventsError) throw eventsError;

    // Build title lookup map
    const titleMap = new Map<string, string>();
    for (const event of events ?? []) {
      titleMap.set(event.id, event.title);
    }

    return (attendances as unknown as AttendanceWithPersonRow[]).map((row) => ({
      id: row.id,
      fieldEventId: row.field_event_id,
      name: getDisplayName(row.people),
      email: row.people.email,
      projectName: row.project_name || '',
      status: row.status as FieldEventAttendee['status'],
      engagementScore: row.engagement_score,
      notes: row.notes || '',
      questionsAsked: row.questions_asked,
      fieldEventTitle: titleMap.get(row.field_event_id) ?? '—'
    }));
  }
};

