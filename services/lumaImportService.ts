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
 */

import { peopleRepo } from './repos/peopleRepo';
import { attendanceRepo } from './repos/attendanceRepo';
import type { LumaGuestRow, LumaImportResult } from '../types';

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
   * Whether to continue processing on row errors (default: true).
   */
  continueOnError?: boolean;
}

/**
 * Import a Luma guest list CSV into Supabase.
 * 
 * ALGORITHM:
 * 1. Parse CSV into rows.
 * 2. For each row with a valid email:
 *    a. Upsert person by email (creates or updates).
 *    b. Upsert attendance by (field_event_id, luma_api_id) or (person_id, field_event_id).
 *    c. Store full raw row in luma_raw_data.
 * 3. Return summary with counts and any errors.
 * 
 * @param csvContent - Raw CSV string from Luma export
 * @param options - Import configuration
 * @returns Import result with statistics
 */
export async function importLumaGuestList(
  csvContent: string,
  options: ImportOptions
): Promise<LumaImportResult> {
  const { fieldEventId, continueOnError = true } = options;

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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for 1-indexed and header row

    try {
      const importResult = await importSingleRow(row, fieldEventId);

      if (importResult.personCreated) {
        result.peopleCreated++;
      } else {
        result.peopleUpdated++;
      }

      if (importResult.attendanceCreated) {
        result.attendanceCreated++;
      } else {
        result.attendanceUpdated++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        row: rowNum,
        email: row.email || '(no email)',
        error: errorMessage
      });

      if (!continueOnError) {
        throw new Error(`Import failed at row ${rowNum}: ${errorMessage}`);
      }
    }
  }

  return result;
}

interface SingleRowImportResult {
  personCreated: boolean;
  attendanceCreated: boolean;
}

/**
 * Import a single Luma guest row.
 */
async function importSingleRow(
  row: LumaGuestRow,
  fieldEventId: string
): Promise<SingleRowImportResult> {
  const email = cleanString(row.email);

  if (!email) {
    throw new Error('Missing email address');
  }

  // Step 1: Upsert person
  const personResult = await peopleRepo.upsertByEmail({
    email,
    name: cleanString(row.name),
    firstName: cleanString(row.first_name),
    lastName: cleanString(row.last_name),
    phoneNumber: cleanString(row.phone_number),
    ethAddress: cleanString(row.eth_address),
    solanaAddress: cleanString(row.solana_address)
  });

  // Step 2: Upsert attendance
  const attendanceResult = await attendanceRepo.upsert({
    personId: personResult.person.id,
    fieldEventId,
    lumaApiId: cleanString(row.api_id),
    lumaCreatedAt: parseTimestamp(row.created_at),
    approvalStatus: cleanString(row.approval_status),
    checkedInAt: parseTimestamp(row.checked_in_at),
    ticketTypeId: cleanString(row.ticket_type_id),
    ticketName: cleanString(row.ticket_name),
    amount: parseNumeric(row.amount),
    amountTax: parseNumeric(row.amount_tax),
    amountDiscount: parseNumeric(row.amount_discount),
    currency: cleanString(row.currency),
    couponCode: cleanString(row.coupon_code),
    surveyResponseRating: cleanString(row.survey_response_rating),
    surveyResponseFeedback: cleanString(row.survey_response_feedback),
    customSource: cleanString(row.custom_source),
    qrCodeUrl: cleanString(row.qr_code_url),
    lumaRawData: row // Store full raw row including custom columns
  });

  return {
    personCreated: personResult.wasCreated,
    attendanceCreated: attendanceResult.wasCreated
  };
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
  // This would typically be done with a SQL query, but we can approximate
  // with the existing repo methods. For production, add a dedicated repo method.
  
  // For now, this is a placeholder that would need a custom query like:
  // SELECT p.id, p.email, p.name, COUNT(a.id) as event_count
  // FROM people p
  // JOIN field_event_attendance a ON a.person_id = p.id
  // GROUP BY p.id, p.email, p.name
  // HAVING COUNT(a.id) >= $1
  // ORDER BY event_count DESC

  // Implementation deferred - would need direct Supabase query
  return [];
}
