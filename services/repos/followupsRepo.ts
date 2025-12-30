import { getSupabaseClient } from '../supabaseClient';
import type { FieldEventFollowup } from '../../types';

type FollowupRow = {
  id: string;
  field_event_id: string;
  attendee_id: string;
  attendee_email: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent';
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapFollowup(row: FollowupRow): FieldEventFollowup {
  return {
    id: row.id,
    fieldEventId: row.field_event_id,
    attendeeId: row.attendee_id,
    attendeeEmail: row.attendee_email,
    subject: row.subject,
    body: row.body,
    status: row.status,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const followupsRepo = {
  async listByFieldEventId(fieldEventId: string): Promise<FieldEventFollowup[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_followups')
      .select('id,field_event_id,attendee_id,attendee_email,subject,body,status,sent_at,created_at,updated_at')
      .eq('field_event_id', fieldEventId);

    if (error) throw error;
    return (data as FollowupRow[]).map(mapFollowup);
  },

  /**
   * Idempotent: returns the existing follow-up for (field_event_id, attendee_id) or creates a new draft.
   * Never overwrites existing content.
   */
  async getOrCreateDraft(params: {
    fieldEventId: string;
    attendeeId: string;
    attendeeEmail: string;
  }): Promise<FieldEventFollowup> {
    const supabase = getSupabaseClient();

    const existing = await supabase
      .from('field_event_followups')
      .select('id,field_event_id,attendee_id,attendee_email,subject,body,status,sent_at,created_at,updated_at')
      .eq('field_event_id', params.fieldEventId)
      .eq('attendee_id', params.attendeeId)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data) return mapFollowup(existing.data as FollowupRow);

    const inserted = await supabase
      .from('field_event_followups')
      .insert({
        field_event_id: params.fieldEventId,
        attendee_id: params.attendeeId,
        attendee_email: params.attendeeEmail,
        subject: '',
        body: '',
        status: 'draft',
        sent_at: null
      })
      .select('id,field_event_id,attendee_id,attendee_email,subject,body,status,sent_at,created_at,updated_at')
      .single();

    if (inserted.error) {
      // If another request created it after our read, re-load the row.
      const isUniqueViolation =
        (inserted.error as any)?.code === '23505' ||
        String(inserted.error.message ?? '').toLowerCase().includes('duplicate');

      if (!isUniqueViolation) throw inserted.error;

      const reread = await supabase
        .from('field_event_followups')
        .select('id,field_event_id,attendee_id,attendee_email,subject,body,status,sent_at,created_at,updated_at')
        .eq('field_event_id', params.fieldEventId)
        .eq('attendee_id', params.attendeeId)
        .single();

      if (reread.error) throw reread.error;
      return mapFollowup(reread.data as FollowupRow);
    }
    return mapFollowup(inserted.data as FollowupRow);
  },

  async saveDraft(params: { followupId: string; subject: string; body: string }): Promise<FieldEventFollowup> {
    const supabase = getSupabaseClient();

    const updated = await supabase
      .from('field_event_followups')
      .update({ subject: params.subject, body: params.body })
      .eq('id', params.followupId)
      .eq('status', 'draft')
      .select('id,field_event_id,attendee_id,attendee_email,subject,body,status,sent_at,created_at,updated_at')
      .maybeSingle();

    if (updated.error) throw updated.error;
    if (!updated.data) throw new Error('Draft is not editable (already sent or missing).');

    return mapFollowup(updated.data as FollowupRow);
  },

  async markSent(followupId: string): Promise<FieldEventFollowup> {
    const supabase = getSupabaseClient();

    const updated = await supabase
      .from('field_event_followups')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', followupId)
      .eq('status', 'draft')
      .is('sent_at', null)
      .select('id,field_event_id,attendee_id,attendee_email,subject,body,status,sent_at,created_at,updated_at')
      .maybeSingle();

    if (updated.error) throw updated.error;
    if (!updated.data) throw new Error('Follow-up is already sent (or missing).');

    return mapFollowup(updated.data as FollowupRow);
  }
};

