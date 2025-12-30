
export enum ProjectStatus {
  SHIPPED = 'Shipped',
  IN_PROGRESS = 'In Progress',
  NOT_STARTED = 'Not Started'
}

/**
 * Attendance status derived from Luma data:
 * - CHECKED_IN: Has a checked_in_at timestamp
 * - APPROVED: approval_status is 'approved' but no check-in
 * - PENDING: approval_status is 'pending_approval' or similar
 * - REJECTED: approval_status is 'rejected' or 'declined'
 * - ALL: No filter (show all)
 */
export enum AttendanceStatus {
  ALL = 'all',
  CHECKED_IN = 'checked_in',
  APPROVED = 'approved',
  PENDING = 'pending',
  REJECTED = 'rejected'
}

export type FieldEventId = string;
export type AttendeeId = string;
export type PersonId = string;
export type AttendanceId = string;

export interface FieldEvent {
  id: FieldEventId;
  title: string;
  date: string;
  venue: string;
  topic: string;
  conversionGoal: string;
}

export interface FieldEventSummary extends FieldEvent {
  attendeeCount: number;
}

// Legacy type for backward compatibility with existing code
export interface FieldEventAttendee {
  id: string;
  name: string;
  email: string;
  projectName: string;
  status: ProjectStatus;
  engagementScore: number; // 0-100
  notes: string;
  questionsAsked: number;
  fieldEventId: FieldEventId;
  // Luma attendance data
  approvalStatus: string | null;
  checkedInAt: string | null;
}

/**
 * Result of paginated attendee query.
 */
export interface PaginatedAttendees {
  attendees: FieldEventAttendee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type FollowupStatus = 'draft' | 'sent';

export interface FieldEventFollowup {
  id: string; // uuid from DB, represented as string in TS
  fieldEventId: FieldEventId;
  attendeeId: AttendeeId;
  attendeeEmail: string;
  subject: string;
  body: string;
  status: FollowupStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  attendanceId?: AttendanceId; // New: FK to attendance record
}

export interface ConversionMetrics {
  totalWorkshops: number;
  totalAttendees: number;
  shipRate: number;
  conversionRate: number;
  estimatedROI: number;
  potentialMRR: number;
}

// =============================================================================
// PEOPLE & ATTENDANCE TYPES (for Luma import)
// =============================================================================

/**
 * Stable identity for a human who may attend multiple field events.
 * Deduplicated by email (case-insensitive).
 */
export interface Person {
  id: PersonId;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  ethAddress: string | null;
  solanaAddress: string | null;
  userId: string | null; // Optional link to authenticated user
  createdAt: string;
  updatedAt: string;
}

/**
 * A person's attendance at a specific field event.
 * Contains event-specific metadata from Luma and local tracking fields.
 */
export interface FieldEventAttendance {
  id: AttendanceId;
  personId: PersonId;
  fieldEventId: FieldEventId;
  
  // Luma identifiers
  lumaApiId: string | null;
  lumaCreatedAt: string | null;
  
  // Luma registration data
  approvalStatus: string | null;
  checkedInAt: string | null;
  
  // Ticket info
  ticketTypeId: string | null;
  ticketName: string | null;
  
  // Payment info
  amount: number | null;
  amountTax: number | null;
  amountDiscount: number | null;
  currency: string | null;
  couponCode: string | null;
  
  // Survey responses
  surveyResponseRating: string | null;
  surveyResponseFeedback: string | null;
  
  // Custom tracking
  customSource: string | null;
  qrCodeUrl: string | null;
  
  // Raw Luma data (preserves custom columns)
  lumaRawData: Record<string, unknown> | null;
  
  // Local tracking fields
  projectName: string;
  status: ProjectStatus;
  engagementScore: number;
  notes: string;
  questionsAsked: number;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Attendance record joined with person data for display.
 */
export interface FieldEventAttendanceWithPerson extends FieldEventAttendance {
  person: Person;
}

// =============================================================================
// LUMA CSV TYPES
// =============================================================================

/**
 * Known fields from Luma guest list CSV export.
 * Custom question columns are captured in the raw data.
 */
export interface LumaGuestRow {
  // Identity
  api_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  
  // Registration
  created_at: string;
  approval_status: string;
  checked_in_at: string;
  
  // Ticket
  ticket_type_id: string;
  ticket_name: string;
  
  // Payment
  amount: string;
  amount_tax: string;
  amount_discount: string;
  currency: string;
  coupon_code: string;
  
  // Crypto
  eth_address: string;
  solana_address: string;
  
  // Survey
  survey_response_rating: string;
  survey_response_feedback: string;
  
  // Tracking
  custom_source: string;
  qr_code_url: string;
  
  // Index signature for custom columns (varies per event)
  [key: string]: string;
}

/**
 * Result of importing a Luma guest list CSV.
 */
export interface LumaImportResult {
  fieldEventId: FieldEventId;
  totalRows: number;
  peopleCreated: number;
  peopleUpdated: number;
  attendanceCreated: number;
  attendanceUpdated: number;
  errors: Array<{ row: number; email: string; error: string }>;
}
