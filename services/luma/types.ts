/**
 * Luma API Types
 * 
 * Based on Luma's public REST API (https://public-api.luma.com)
 * These types represent the external Luma data model.
 */

// =============================================================================
// LUMA EVENT TYPES
// =============================================================================

export interface LumaEvent {
  api_id: string;
  name: string;
  description?: string;
  start_at: string; // ISO timestamp
  end_at?: string;
  timezone: string;
  url: string;
  cover_url?: string;
  geo_address_json?: {
    city?: string;
    region?: string;
    country?: string;
    address?: string;
    full_address?: string;
  };
  event_type?: string;
  visibility?: string;
  meeting_url?: string;
  calendar_api_id?: string;
}

export interface LumaEventEntry {
  api_id: string;
  event: LumaEvent;
}

export interface LumaEventsResponse {
  entries: LumaEventEntry[];
  has_more: boolean;
  next_cursor?: string;
}

// =============================================================================
// LUMA GUEST TYPES
// =============================================================================

export interface LumaGuest {
  api_id: string;
  event_api_id: string;
  
  // Guest identity
  user_api_id?: string;
  user_name?: string;
  user_email?: string;
  
  // Alternative: guest info when not linked to user
  guest_name?: string;
  guest_email?: string;
  
  // Registration state
  approval_status: 'approved' | 'pending_approval' | 'declined' | 'waitlisted' | string;
  created_at: string;
  registered_at?: string;
  
  // Check-in
  checked_in_at?: string;
  
  // Ticket
  ticket_api_id?: string;
  ticket_type_api_id?: string;
  ticket_type_name?: string;
  ticket_price_cents?: number;
  ticket_currency?: string;
  
  // Payment
  amount_paid_cents?: number;
  amount_refunded_cents?: number;
  discount_code?: string;
  
  // Survey responses (varies per event)
  answers?: Record<string, unknown>;
  
  // Contact
  phone_number?: string;
  
  // Crypto addresses
  eth_address?: string;
  solana_address?: string;
  
  // Source tracking
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  
  // Additional fields Luma may add
  [key: string]: unknown;
}

export interface LumaGuestEntry {
  api_id: string;
  guest: LumaGuest;
}

export interface LumaGuestsResponse {
  entries: LumaGuestEntry[];
  has_more: boolean;
  next_cursor?: string;
}

// =============================================================================
// SYNC TYPES
// =============================================================================

export interface LumaSyncResult {
  eventApiId: string;
  eventName: string;
  fieldEventId: string;
  totalGuests: number;
  peopleCreated: number;
  peopleUpdated: number;
  attendanceCreated: number;
  attendanceUpdated: number;
  errors: Array<{ guestApiId: string; email: string; error: string }>;
}

export interface LumaSyncOptions {
  /** Luma event API ID to sync */
  lumaEventApiId: string;
  
  /** Field event ID to associate attendance with. If not provided, creates new event. */
  fieldEventId?: string;
  
  /** Batch size for database operations (default: 50) */
  batchSize?: number;
}
