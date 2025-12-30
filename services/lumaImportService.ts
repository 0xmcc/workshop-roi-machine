/**
 * Luma Guest List Import Service
 * 
 * Imports Luma CSV exports into Supabase, correctly tracking repeat attendees
 * across multiple field events.
 * 
 * INVARIANTS:
 * 1. Each person has one row in `people`, identified by email (case-insensitive).
 * 2. Each (person, field_event) pair has at most one attendance record.
 * 3. Re-importing the same CSV is idempotent (no duplicates created).
 * 4. All raw Luma data (including custom columns) is preserved in luma_raw_data.
 * 
 * IDEMPOTENCY STRATEGY:
 * - Primary dedup key: (field_event_id, luma_api_id)
 * - Secondary dedup key: (person_id, field_event_id)
 * - On re-import, Luma fields are updated but local tracking fields are preserved.
 * 
 * PERFORMANCE:
 * - Uses batched upserts (default 50 rows per batch)
 * - ~3 queries per batch instead of 2 queries per row
 * - 1000 rows = ~60 queries instead of ~2000 queries
 */

import { getSupabaseClient } from './supabaseClient';
import type { LumaGuestRow, LumaImportResult } from '../types';

const BATCH_SIZE = 50;

// =============================================================================
// CSV PARSING
// =============================================================================

/**
 * Parse a CSV string into an array of row objects.
 * Handles quoted fields and custom columns.
 */
export function parseLumaCsv(csvContent: string): LumaGuestRow[] {
  const lines = csvContent.split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows: LumaGuestRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim();
      const value = values[j]?.trim() ?? '';
      row[header] = value;
    }

    rows.push(row as LumaGuestRow);
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields with commas and escaped quotes.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Don't forget the last field
  result.push(current);

  return result;
}

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

/**
 * Parse a numeric string, returning null for empty/invalid values.
 */
function parseNumeric(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse a timestamp string, returning null for empty/invalid values.
 */
function parseTimestamp(value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  // Luma timestamps are typically ISO format
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Clean a string value, returning null for empty strings.
 */
function cleanString(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// =============================================================================
// IMPORT PIPELINE
// =============================================================================

export interface ImportOptions {
  /**
   * Field event ID to associate attendance records with.
   */
  fieldEventId: string;

  /**
   * Batch size for bulk operations (default: 50).
   */
  batchSize?: number;
}

/**
 * Import a Luma guest list CSV into Supabase using batched operations.
 * 
 * ALGORITHM:
 * 1. Parse CSV into rows, filter valid emails
 * 2. Process in batches of batchSize rows:
 *    a. Batch upsert people by email (1 query)
 *    b. Fetch person IDs for batch (1 query)
 *    c. Batch upsert attendance records (1 query)
 * 3. Return summary with counts and any errors.
 * 
 * PERFORMANCE: ~3 queries per batch instead of 2 queries per row
 * 
 * @param csvContent - Raw CSV string from Luma export
 * @param options - Import configuration
 * @returns Import result with statistics
 */
export async function importLumaGuestList(
  csvContent: string,
  options: ImportOptions
): Promise<LumaImportResult> {
  const { fieldEventId, batchSize = BATCH_SIZE } = options;
  const supabase = getSupabaseClient();

  const rows = parseLumaCsv(csvContent);

  const result: LumaImportResult = {
    fieldEventId,
    totalRows: rows.length,
    peopleCreated: 0,
    peopleUpdated: 0,
    attendanceCreated: 0,
    attendanceUpdated: 0,
    errors: []
  };

  // Filter and prepare rows with valid emails
  const validRows: Array<{ rowNum: number; row: LumaGuestRow; email: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for 1-indexed and header row
    const email = cleanString(row.email);
    
    if (!email) {
      result.errors.push({ row: rowNum, email: '(no email)', error: 'Missing email address' });
      continue;
    }
    if (!email.includes('@')) {
      result.errors.push({ row: rowNum, email, error: 'Invalid email format' });
      continue;
    }
    
    validRows.push({ rowNum, row, email: email.toLowerCase() });
  }

  // Process in batches
  for (let i = 0; i < validRows.length; i += batchSize) {
    const batch = validRows.slice(i, i + batchSize);
    
    try {
      const batchResult = await processBatch(supabase, batch, fieldEventId);
      result.peopleCreated += batchResult.peopleCreated;
      result.peopleUpdated += batchResult.peopleUpdated;
      result.attendanceCreated += batchResult.attendanceCreated;
      result.attendanceUpdated += batchResult.attendanceUpdated;
      result.errors.push(...batchResult.errors);
    } catch (error) {
      // If entire batch fails, record error for all rows in batch
      const errorMessage = error instanceof Error ? error.message : String(error);
      for (const { rowNum, email } of batch) {
        result.errors.push({ row: rowNum, email, error: `Batch failed: ${errorMessage}` });
      }
    }
  }

  return result;
}

interface BatchResult {
  peopleCreated: number;
  peopleUpdated: number;
  attendanceCreated: number;
  attendanceUpdated: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

/**
 * Process a batch of rows with bulk operations.
 */
async function processBatch(
  supabase: ReturnType<typeof getSupabaseClient>,
  batch: Array<{ rowNum: number; row: LumaGuestRow; email: string }>,
  fieldEventId: string
): Promise<BatchResult> {
  const result: BatchResult = {
    peopleCreated: 0,
    peopleUpdated: 0,
    attendanceCreated: 0,
    attendanceUpdated: 0,
    errors: []
  };

  // Dedupe emails within batch (keep first occurrence)
  const emailToRow = new Map<string, { rowNum: number; row: LumaGuestRow }>();
  for (const { rowNum, row, email } of batch) {
    if (!emailToRow.has(email)) {
      emailToRow.set(email, { rowNum, row });
    }
  }

  const uniqueEmails = Array.from(emailToRow.keys());

  // Step 1: Get existing people by email
  const { data: existingPeople, error: fetchError } = await supabase
    .from('people')
    .select('id, email')
    .in('email', uniqueEmails);

  if (fetchError) throw fetchError;

  const existingEmailToId = new Map<string, string>();
  for (const person of existingPeople || []) {
    existingEmailToId.set(person.email.toLowerCase(), person.id);
  }

  // Step 2: Prepare people upserts
  const peopleToUpsert = [];
  for (const [email, { row }] of emailToRow) {
    peopleToUpsert.push({
      email,
      name: cleanString(row.name),
      first_name: cleanString(row.first_name),
      last_name: cleanString(row.last_name),
      phone_number: cleanString(row.phone_number),
      eth_address: cleanString(row.eth_address),
      solana_address: cleanString(row.solana_address)
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
  // Also include existing people not in upsert response
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

  // Step 4: Get existing attendance records for this event
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
  for (const [email, { row }] of emailToRow) {
    const personId = emailToPersonId.get(email);
    if (!personId) {
      result.errors.push({ 
        row: emailToRow.get(email)!.rowNum, 
        email, 
        error: 'Could not resolve person ID' 
      });
      continue;
    }

    attendanceToUpsert.push({
      person_id: personId,
      field_event_id: fieldEventId,
      luma_api_id: cleanString(row.api_id),
      luma_created_at: parseTimestamp(row.created_at),
      approval_status: cleanString(row.approval_status),
      checked_in_at: parseTimestamp(row.checked_in_at),
      ticket_type_id: cleanString(row.ticket_type_id),
      ticket_name: cleanString(row.ticket_name),
      amount: parseNumeric(row.amount),
      amount_tax: parseNumeric(row.amount_tax),
      amount_discount: parseNumeric(row.amount_discount),
      currency: cleanString(row.currency),
      coupon_code: cleanString(row.coupon_code),
      survey_response_rating: cleanString(row.survey_response_rating),
      survey_response_feedback: cleanString(row.survey_response_feedback),
      custom_source: cleanString(row.custom_source),
      qr_code_url: cleanString(row.qr_code_url),
      luma_raw_data: row
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
// VALIDATION
// =============================================================================

/**
 * Validate a CSV before import (dry run).
 * Returns validation errors without modifying the database.
 */
export function validateLumaCsv(csvContent: string): {
  valid: boolean;
  rowCount: number;
  errors: Array<{ row: number; error: string }>;
} {
  const rows = parseLumaCsv(csvContent);
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const email = cleanString(row.email);
    if (!email) {
      errors.push({ row: rowNum, error: 'Missing email address' });
      continue;
    }

    // Basic email format validation
    if (!email.includes('@')) {
      errors.push({ row: rowNum, error: `Invalid email format: ${email}` });
    }
  }

  return {
    valid: errors.length === 0,
    rowCount: rows.length,
    errors
  };
}

// =============================================================================
// UTILITY: DETECT REPEAT ATTENDEES
// =============================================================================

/**
 * After import, identify people who have attended multiple events.
 * Useful for engagement tracking and analytics.
 */
export async function getRepeatAttendees(minEvents: number = 2): Promise<
  Array<{
    personId: string;
    email: string;
    name: string | null;
    eventCount: number;
  }>
> {
  const supabase = getSupabaseClient();
  
  // Use RPC or raw query for aggregation
  // For now, fetch all and aggregate in JS (not ideal for large datasets)
  const { data, error } = await supabase
    .from('field_event_attendance')
    .select('person_id, people(id, email, name)');

  if (error) throw error;

  const countMap = new Map<string, { email: string; name: string | null; count: number }>();
  
  for (const row of data || []) {
    const person = row.people as { id: string; email: string; name: string | null } | null;
    if (!person) continue;
    
    const existing = countMap.get(person.id);
    if (existing) {
      existing.count++;
    } else {
      countMap.set(person.id, { email: person.email, name: person.name, count: 1 });
    }
  }

  return Array.from(countMap.entries())
    .filter(([_, v]) => v.count >= minEvents)
    .map(([personId, v]) => ({
      personId,
      email: v.email,
      name: v.name,
      eventCount: v.count
    }))
    .sort((a, b) => b.eventCount - a.eventCount);
}
