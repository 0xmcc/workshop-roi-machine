import { getSupabaseClient } from '../supabaseClient';
import type { FieldEventAttendee, PaginatedAttendees } from '../../types';
import { AttendanceStatus } from '../../types';

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
  approval_status: string | null;
  checked_in_at: string | null;
  people: {
    id: string;
    email: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
};

export interface ListAttendeesParams {
  fieldEventId: string;
  page?: number;
  pageSize?: number;
  attendanceStatus?: AttendanceStatus;
}

function getDisplayName(person: AttendanceWithPersonRow['people']): string {
  if (person.name) return person.name;
  if (person.first_name || person.last_name) {
    return [person.first_name, person.last_name].filter(Boolean).join(' ');
  }
  return person.email.split('@')[0];
}

export const attendeesRepo = {
  /**
   * List attendees for a field event with pagination and filtering.
   * Queries from field_event_attendance joined with people.
   */
  async listByFieldEventId(params: ListAttendeesParams): Promise<PaginatedAttendees> {
    const { fieldEventId, page = 1, pageSize = 20, attendanceStatus = AttendanceStatus.ALL } = params;
    const supabase = getSupabaseClient();

    // Build base query
    let query = supabase
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
        approval_status,
        checked_in_at,
        people (
          id,
          email,
          name,
          first_name,
          last_name
        )
      `, { count: 'exact' })
      .eq('field_event_id', fieldEventId);

    // Apply attendance status filter
    if (attendanceStatus !== AttendanceStatus.ALL) {
      switch (attendanceStatus) {
        case AttendanceStatus.CHECKED_IN:
          query = query.not('checked_in_at', 'is', null);
          break;
        case AttendanceStatus.APPROVED:
          query = query.eq('approval_status', 'approved').is('checked_in_at', null);
          break;
        case AttendanceStatus.PENDING:
          query = query.or('approval_status.eq.pending_approval,approval_status.eq.pending,approval_status.is.null');
          break;
        case AttendanceStatus.REJECTED:
          query = query.or('approval_status.eq.rejected,approval_status.eq.declined');
          break;
      }
    }

    // Apply pagination and ordering
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = await query
      .order('engagement_score', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const total = count ?? 0;
    const attendees = (data as unknown as AttendanceWithPersonRow[]).map((row) => ({
      id: row.id,
      fieldEventId: row.field_event_id,
      name: getDisplayName(row.people),
      email: row.people.email,
      projectName: row.project_name || '',
      status: row.status as FieldEventAttendee['status'],
      engagementScore: row.engagement_score,
      notes: row.notes || '',
      questionsAsked: row.questions_asked,
      approvalStatus: row.approval_status,
      checkedInAt: row.checked_in_at
    }));

    return {
      attendees,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
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
        approval_status,
        checked_in_at,
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
      approvalStatus: row.approval_status,
      checkedInAt: row.checked_in_at,
      fieldEventTitle: titleMap.get(row.field_event_id) ?? '—'
    }));
  }
};

