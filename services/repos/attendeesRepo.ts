import { getSupabaseClient } from '../supabaseClient';
import type { FieldEventAttendee } from '../../types';

type AttendeeRow = {
  id: string;
  field_event_id: string;
  name: string;
  email: string;
  project_name: string;
  status: string;
  engagement_score: number;
  notes: string;
  questions_asked: number;
  field_events?: { title: string } | null;
};

export const attendeesRepo = {
  async listByFieldEventId(fieldEventId: string): Promise<FieldEventAttendee[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendees')
      .select('id,field_event_id,name,email,project_name,status,engagement_score,notes,questions_asked')
      .eq('field_event_id', fieldEventId)
      .order('engagement_score', { ascending: false });

    if (error) throw error;

    return (data as AttendeeRow[]).map((row) => ({
      id: row.id,
      fieldEventId: row.field_event_id,
      name: row.name,
      email: row.email,
      projectName: row.project_name,
      status: row.status as FieldEventAttendee['status'],
      engagementScore: row.engagement_score,
      notes: row.notes,
      questionsAsked: row.questions_asked
    }));
  },

  async listHotLeads(limit: number): Promise<Array<FieldEventAttendee & { fieldEventTitle: string }>> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendees')
      .select(
        'id,field_event_id,name,email,project_name,status,engagement_score,notes,questions_asked,field_events(title)'
      )
      .gte('engagement_score', 85)
      .order('engagement_score', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data as AttendeeRow[]).map((row) => ({
      id: row.id,
      fieldEventId: row.field_event_id,
      name: row.name,
      email: row.email,
      projectName: row.project_name,
      status: row.status as FieldEventAttendee['status'],
      engagementScore: row.engagement_score,
      notes: row.notes,
      questionsAsked: row.questions_asked,
      fieldEventTitle: row.field_events?.title ?? '—'
    }));
  }
};

