/**
 * Luma Sync Service
 * 
 * Syncs attendees from Luma events into Supabase.
 * 
 * DESIGN PRINCIPLES:
 * - Idempotent: Re-running sync is safe and won't duplicate data
 * - Resilient: Partial failures don't corrupt state; sync can resume
 * - Preserving: All raw Luma data is stored verbatim
 * - Batched: Uses efficient batch operations (not 1 query per guest)
 * 
 * DATA FLOW:
 * 1. Fetch guests from Luma API
 * 2. Extract unique people by email
 * 3. Batch upsert people (dedup by email)
 * 4. Batch upsert attendance (dedup by person_id + field_event_id)
 * 5. Store raw Luma response in luma_raw_data
 * 
 * INVARIANTS:
 * - Each person has exactly one row, identified by email
 * - Each (person, field_event) pair has at most one attendance record
 * - luma_api_id on attendance enables idempotent re-sync
 * - Raw Luma data preserved for audit/debugging
 */

import { getSupabaseClient } from '../supabaseClient';
import { lumaClient } from './client';
import { fieldEventsRepo } from '../repos/fieldEventsRepo';
import type { LumaGuest, LumaSyncResult, LumaSyncOptions } from './types';

const DEFAULT_BATCH_SIZE = 50;

// =============================================================================
// SYNC IMPLEMENTATION
// =============================================================================

/**
 * Sync guests from a Luma event into Supabase.
 * 
 * @param options - Sync configuration
 * @returns Sync result with statistics
 */
export async function syncLumaEvent(options: LumaSyncOptions): Promise<LumaSyncResult> {
  const { lumaEventApiId, batchSize = DEFAULT_BATCH_SIZE } = options;
  let { fieldEventId } = options;

  // Step 1: Fetch event details from Luma
  const lumaEvent = await lumaClient.getEvent(lumaEventApiId);
  if (!lumaEvent) {
    throw new Error(`Luma event not found: ${lumaEventApiId}`);
  }

  // Step 2: Create or get field event
  if (!fieldEventId) {
    const newEvent = await fieldEventsRepo.create({
      title: lumaEvent.name,
      date: lumaEvent.start_at.split('T')[0], // Extract date from ISO timestamp
      venue: lumaEvent.geo_address_json?.city || lumaEvent.geo_address_json?.full_address || 'Online',
      topic: lumaEvent.event_type || 'General',
      conversionGoal: 'Engagement'
    });
    fieldEventId = newEvent.id;
  }

  // Step 3: Fetch all guests from Luma
  const lumaGuests = await lumaClient.listGuests(lumaEventApiId);

  const result: LumaSyncResult = {
    eventApiId: lumaEventApiId,
    eventName: lumaEvent.name,
    fieldEventId,
    totalGuests: lumaGuests.length,
    peopleCreated: 0,
    peopleUpdated: 0,
    attendanceCreated: 0,
    attendanceUpdated: 0,
    errors: []
  };

  if (lumaGuests.length === 0) {
    return result;
  }

  // Step 4: Filter guests with valid emails
  const validGuests: Array<{ guest: LumaGuest; email: string }> = [];
  for (const guest of lumaGuests) {
    const email = extractEmail(guest);
    if (!email) {
      result.errors.push({
        guestApiId: guest.api_id,
        email: '(no email)',
        error: 'Guest has no email address'
      });
      continue;
    }
    validGuests.push({ guest, email: email.toLowerCase() });
  }

  // Step 5: Process in batches
  const supabase = getSupabaseClient();
  
  for (let i = 0; i < validGuests.length; i += batchSize) {
    const batch = validGuests.slice(i, i + batchSize);
    
    try {
      const batchResult = await processBatch(supabase, batch, fieldEventId);
      result.peopleCreated += batchResult.peopleCreated;
      result.peopleUpdated += batchResult.peopleUpdated;
      result.attendanceCreated += batchResult.attendanceCreated;
      result.attendanceUpdated += batchResult.attendanceUpdated;
      result.errors.push(...batchResult.errors);
    } catch (error) {
      // Record error for all guests in failed batch
      const errorMessage = error instanceof Error ? error.message : String(error);
      for (const { guest, email } of batch) {
        result.errors.push({
          guestApiId: guest.api_id,
          email,
          error: `Batch failed: ${errorMessage}`
        });
      }
    }
  }

  return result;
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

interface BatchResult {
  peopleCreated: number;
  peopleUpdated: number;
  attendanceCreated: number;
  attendanceUpdated: number;
  errors: Array<{ guestApiId: string; email: string; error: string }>;
}

async function processBatch(
  supabase: ReturnType<typeof getSupabaseClient>,
  batch: Array<{ guest: LumaGuest; email: string }>,
  fieldEventId: string
): Promise<BatchResult> {
  const result: BatchResult = {
    peopleCreated: 0,
    peopleUpdated: 0,
    attendanceCreated: 0,
    attendanceUpdated: 0,
    errors: []
  };

  // Dedupe by email within batch
  const emailToGuest = new Map<string, LumaGuest>();
  for (const { guest, email } of batch) {
    if (!emailToGuest.has(email)) {
      emailToGuest.set(email, guest);
    }
  }

  const uniqueEmails = Array.from(emailToGuest.keys());

  // Step 1: Fetch existing people
  const { data: existingPeople, error: fetchPeopleError } = await supabase
    .from('people')
    .select('id, email')
    .in('email', uniqueEmails);

  if (fetchPeopleError) throw fetchPeopleError;

  const existingEmailToId = new Map<string, string>();
  for (const person of existingPeople || []) {
    existingEmailToId.set(person.email.toLowerCase(), person.id);
  }

  // Step 2: Prepare people upserts
  const peopleToUpsert = [];
  for (const [email, guest] of emailToGuest) {
    const name = extractName(guest);
    peopleToUpsert.push({
      email,
      name: name,
      first_name: extractFirstName(guest),
      last_name: extractLastName(guest),
      phone_number: guest.phone_number || null,
      eth_address: guest.eth_address || null,
      solana_address: guest.solana_address || null
    });
  }

  // Step 3: Batch upsert people
  const { data: upsertedPeople, error: upsertPeopleError } = await supabase
    .from('people')
    .upsert(peopleToUpsert, {
      onConflict: 'email',
      ignoreDuplicates: false
    })
    .select('id, email');

  if (upsertPeopleError) throw upsertPeopleError;

  // Build email -> person_id map
  const emailToPersonId = new Map<string, string>();
  for (const person of upsertedPeople || []) {
    emailToPersonId.set(person.email.toLowerCase(), person.id);
  }
  // Include existing people not in upsert response
  for (const [email, id] of existingEmailToId) {
    if (!emailToPersonId.has(email)) {
      emailToPersonId.set(email, id);
    }
  }

  // Count people created vs updated
  for (const email of uniqueEmails) {
    if (existingEmailToId.has(email)) {
      result.peopleUpdated++;
    } else {
      result.peopleCreated++;
    }
  }

  // Step 4: Fetch existing attendance records
  const personIds = Array.from(emailToPersonId.values());
  const { data: existingAttendance, error: fetchAttendanceError } = await supabase
    .from('field_event_attendance')
    .select('id, person_id')
    .eq('field_event_id', fieldEventId)
    .in('person_id', personIds);

  if (fetchAttendanceError) throw fetchAttendanceError;

  const existingAttendancePersonIds = new Set(
    (existingAttendance || []).map(a => a.person_id)
  );

  // Step 5: Prepare attendance upserts
  const attendanceToUpsert = [];
  for (const [email, guest] of emailToGuest) {
    const personId = emailToPersonId.get(email);
    if (!personId) {
      result.errors.push({
        guestApiId: guest.api_id,
        email,
        error: 'Could not resolve person ID'
      });
      continue;
    }

    attendanceToUpsert.push({
      person_id: personId,
      field_event_id: fieldEventId,
      luma_api_id: guest.api_id,
      luma_created_at: guest.created_at || null,
      approval_status: guest.approval_status || null,
      checked_in_at: guest.checked_in_at || null,
      ticket_type_id: guest.ticket_type_api_id || null,
      ticket_name: guest.ticket_type_name || null,
      amount: guest.amount_paid_cents ? guest.amount_paid_cents / 100 : null,
      amount_tax: null,
      amount_discount: guest.amount_refunded_cents ? guest.amount_refunded_cents / 100 : null,
      currency: guest.ticket_currency || null,
      coupon_code: guest.discount_code || null,
      survey_response_rating: null,
      survey_response_feedback: null,
      custom_source: guest.utm_source || guest.referrer || null,
      qr_code_url: null,
      // Store full raw Luma response for audit/debugging
      luma_raw_data: guest
    });

    // Count attendance created vs updated
    if (existingAttendancePersonIds.has(personId)) {
      result.attendanceUpdated++;
    } else {
      result.attendanceCreated++;
    }
  }

  // Step 6: Batch upsert attendance
  if (attendanceToUpsert.length > 0) {
    const { error: upsertAttendanceError } = await supabase
      .from('field_event_attendance')
      .upsert(attendanceToUpsert, {
        onConflict: 'person_id,field_event_id',
        ignoreDuplicates: false
      });

    if (upsertAttendanceError) throw upsertAttendanceError;
  }

  return result;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract email from Luma guest record.
 * Luma may store email in different fields depending on whether guest is a user.
 */
function extractEmail(guest: LumaGuest): string | null {
  const email = guest.user_email || guest.guest_email;
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim();
  return trimmed && trimmed.includes('@') ? trimmed : null;
}

/**
 * Extract display name from Luma guest record.
 */
function extractName(guest: LumaGuest): string | null {
  const name = guest.user_name || guest.guest_name;
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed || null;
}

/**
 * Extract first name from full name.
 */
function extractFirstName(guest: LumaGuest): string | null {
  const name = extractName(guest);
  if (!name) return null;
  const parts = name.split(' ');
  return parts[0] || null;
}

/**
 * Extract last name from full name.
 */
function extractLastName(guest: LumaGuest): string | null {
  const name = extractName(guest);
  if (!name) return null;
  const parts = name.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export { lumaClient, setLumaApiKey, clearLumaApiKey } from './client';
export type { LumaEvent, LumaGuest, LumaSyncResult, LumaSyncOptions } from './types';
