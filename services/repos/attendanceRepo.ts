import { getSupabaseClient } from '../supabaseClient';
import type { FieldEventAttendance, FieldEventAttendanceWithPerson, Person, ProjectStatus } from '../../types';

type AttendanceRow = {
  id: string;
  person_id: string;
  field_event_id: string;
  luma_api_id: string | null;
  luma_created_at: string | null;
  approval_status: string | null;
  checked_in_at: string | null;
  ticket_type_id: string | null;
  ticket_name: string | null;
  amount: number | null;
  amount_tax: number | null;
  amount_discount: number | null;
  currency: string | null;
  coupon_code: string | null;
  survey_response_rating: string | null;
  survey_response_feedback: string | null;
  custom_source: string | null;
  qr_code_url: string | null;
  luma_raw_data: Record<string, unknown> | null;
  project_name: string;
  status: string;
  engagement_score: number;
  notes: string;
  questions_asked: number;
  created_at: string;
  updated_at: string;
};

type PersonRow = {
  id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  eth_address: string | null;
  solana_address: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapAttendance(row: AttendanceRow): FieldEventAttendance {
  return {
    id: row.id,
    personId: row.person_id,
    fieldEventId: row.field_event_id,
    lumaApiId: row.luma_api_id,
    lumaCreatedAt: row.luma_created_at,
    approvalStatus: row.approval_status,
    checkedInAt: row.checked_in_at,
    ticketTypeId: row.ticket_type_id,
    ticketName: row.ticket_name,
    amount: row.amount,
    amountTax: row.amount_tax,
    amountDiscount: row.amount_discount,
    currency: row.currency,
    couponCode: row.coupon_code,
    surveyResponseRating: row.survey_response_rating,
    surveyResponseFeedback: row.survey_response_feedback,
    customSource: row.custom_source,
    qrCodeUrl: row.qr_code_url,
    lumaRawData: row.luma_raw_data,
    projectName: row.project_name,
    status: row.status as ProjectStatus,
    engagementScore: row.engagement_score,
    notes: row.notes,
    questionsAsked: row.questions_asked,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneNumber: row.phone_number,
    ethAddress: row.eth_address,
    solanaAddress: row.solana_address,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export interface UpsertAttendanceInput {
  personId: string;
  fieldEventId: string;
  lumaApiId?: string | null;
  lumaCreatedAt?: string | null;
  approvalStatus?: string | null;
  checkedInAt?: string | null;
  ticketTypeId?: string | null;
  ticketName?: string | null;
  amount?: number | null;
  amountTax?: number | null;
  amountDiscount?: number | null;
  currency?: string | null;
  couponCode?: string | null;
  surveyResponseRating?: string | null;
  surveyResponseFeedback?: string | null;
  customSource?: string | null;
  qrCodeUrl?: string | null;
  lumaRawData?: Record<string, unknown> | null;
}

export interface UpsertAttendanceResult {
  attendance: FieldEventAttendance;
  wasCreated: boolean;
}

export const attendanceRepo = {
  /**
   * Find attendance by person and field event.
   */
  async findByPersonAndEvent(personId: string, fieldEventId: string): Promise<FieldEventAttendance | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendance')
      .select('*')
      .eq('person_id', personId)
      .eq('field_event_id', fieldEventId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapAttendance(data as AttendanceRow);
  },

  /**
   * Find attendance by Luma API ID within a field event.
   * Used for idempotent re-imports.
   */
  async findByLumaApiId(fieldEventId: string, lumaApiId: string): Promise<FieldEventAttendance | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendance')
      .select('*')
      .eq('field_event_id', fieldEventId)
      .eq('luma_api_id', lumaApiId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapAttendance(data as AttendanceRow);
  },

  /**
   * Upsert attendance record.
   * 
   * IDEMPOTENCY STRATEGY:
   * 1. If lumaApiId is provided, use (field_event_id, luma_api_id) as the dedup key.
   * 2. Otherwise, use (person_id, field_event_id) as the dedup key.
   * 
   * On conflict, update Luma-sourced fields but preserve local tracking fields
   * (project_name, status, engagement_score, notes, questions_asked).
   */
  async upsert(input: UpsertAttendanceInput): Promise<UpsertAttendanceResult> {
    const supabase = getSupabaseClient();

    // Check for existing attendance
    let existing: FieldEventAttendance | null = null;

    if (input.lumaApiId) {
      existing = await this.findByLumaApiId(input.fieldEventId, input.lumaApiId);
    }

    if (!existing) {
      existing = await this.findByPersonAndEvent(input.personId, input.fieldEventId);
    }

    if (existing) {
      // Update existing attendance with Luma data (preserve local tracking fields)
      const updates: Record<string, unknown> = {};

      // Only update Luma-sourced fields, never overwrite local tracking
      if (input.lumaApiId !== undefined) updates.luma_api_id = input.lumaApiId;
      if (input.lumaCreatedAt !== undefined) updates.luma_created_at = input.lumaCreatedAt;
      if (input.approvalStatus !== undefined) updates.approval_status = input.approvalStatus;
      if (input.checkedInAt !== undefined) updates.checked_in_at = input.checkedInAt;
      if (input.ticketTypeId !== undefined) updates.ticket_type_id = input.ticketTypeId;
      if (input.ticketName !== undefined) updates.ticket_name = input.ticketName;
      if (input.amount !== undefined) updates.amount = input.amount;
      if (input.amountTax !== undefined) updates.amount_tax = input.amountTax;
      if (input.amountDiscount !== undefined) updates.amount_discount = input.amountDiscount;
      if (input.currency !== undefined) updates.currency = input.currency;
      if (input.couponCode !== undefined) updates.coupon_code = input.couponCode;
      if (input.surveyResponseRating !== undefined) updates.survey_response_rating = input.surveyResponseRating;
      if (input.surveyResponseFeedback !== undefined) updates.survey_response_feedback = input.surveyResponseFeedback;
      if (input.customSource !== undefined) updates.custom_source = input.customSource;
      if (input.qrCodeUrl !== undefined) updates.qr_code_url = input.qrCodeUrl;
      if (input.lumaRawData !== undefined) updates.luma_raw_data = input.lumaRawData;

      if (Object.keys(updates).length === 0) {
        return { attendance: existing, wasCreated: false };
      }

      const { data, error } = await supabase
        .from('field_event_attendance')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      return { attendance: mapAttendance(data as AttendanceRow), wasCreated: false };
    }

    // Create new attendance
    const insertData = {
      person_id: input.personId,
      field_event_id: input.fieldEventId,
      luma_api_id: input.lumaApiId ?? null,
      luma_created_at: input.lumaCreatedAt ?? null,
      approval_status: input.approvalStatus ?? null,
      checked_in_at: input.checkedInAt ?? null,
      ticket_type_id: input.ticketTypeId ?? null,
      ticket_name: input.ticketName ?? null,
      amount: input.amount ?? null,
      amount_tax: input.amountTax ?? null,
      amount_discount: input.amountDiscount ?? null,
      currency: input.currency ?? null,
      coupon_code: input.couponCode ?? null,
      survey_response_rating: input.surveyResponseRating ?? null,
      survey_response_feedback: input.surveyResponseFeedback ?? null,
      custom_source: input.customSource ?? null,
      qr_code_url: input.qrCodeUrl ?? null,
      luma_raw_data: input.lumaRawData ?? null
    };

    const { data, error } = await supabase
      .from('field_event_attendance')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      // Handle race condition
      const isUniqueViolation =
        (error as { code?: string })?.code === '23505' ||
        String(error.message ?? '').toLowerCase().includes('duplicate');

      if (isUniqueViolation) {
        const retryAttendance = await this.findByPersonAndEvent(input.personId, input.fieldEventId);
        if (retryAttendance) {
          return { attendance: retryAttendance, wasCreated: false };
        }
      }
      throw error;
    }

    return { attendance: mapAttendance(data as AttendanceRow), wasCreated: true };
  },

  /**
   * List all attendance records for a field event with person data.
   */
  async listByFieldEventId(fieldEventId: string): Promise<FieldEventAttendanceWithPerson[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendance')
      .select('*, people(*)')
      .eq('field_event_id', fieldEventId)
      .order('engagement_score', { ascending: false });

    if (error) throw error;

    return (data as Array<AttendanceRow & { people: PersonRow }>).map((row) => ({
      ...mapAttendance(row),
      person: mapPerson(row.people)
    }));
  },

  /**
   * List all attendance records for a person across all events.
   */
  async listByPersonId(personId: string): Promise<FieldEventAttendance[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendance')
      .select('*')
      .eq('person_id', personId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as AttendanceRow[]).map(mapAttendance);
  },

  /**
   * Update local tracking fields for an attendance record.
   */
  async updateTracking(
    attendanceId: string,
    updates: {
      projectName?: string;
      status?: ProjectStatus;
      engagementScore?: number;
      notes?: string;
      questionsAsked?: number;
    }
  ): Promise<FieldEventAttendance> {
    const supabase = getSupabaseClient();

    const updateData: Record<string, unknown> = {};
    if (updates.projectName !== undefined) updateData.project_name = updates.projectName;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.engagementScore !== undefined) updateData.engagement_score = updates.engagementScore;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.questionsAsked !== undefined) updateData.questions_asked = updates.questionsAsked;

    const { data, error } = await supabase
      .from('field_event_attendance')
      .update(updateData)
      .eq('id', attendanceId)
      .select('*')
      .single();

    if (error) throw error;
    return mapAttendance(data as AttendanceRow);
  },

  /**
   * Get attendance count for a field event.
   */
  async countByFieldEventId(fieldEventId: string): Promise<number> {
    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('field_event_attendance')
      .select('id', { count: 'exact', head: true })
      .eq('field_event_id', fieldEventId);

    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Find attendance by ID.
   */
  async findById(id: string): Promise<FieldEventAttendance | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('field_event_attendance')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapAttendance(data as AttendanceRow);
  }
};
