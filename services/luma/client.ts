/**
 * Luma API Client Abstraction
 * 
 * DESIGN FOR BACKEND MIGRATION:
 * This module exposes a `LumaClient` interface that abstracts Luma API access.
 * Currently implemented as direct browser-to-Luma calls (for development only).
 * 
 * To migrate to a backend:
 * 1. Create a backend endpoint that proxies Luma API calls
 * 2. Replace `DirectLumaClient` with `BackendLumaClient` that calls your API
 * 3. Application code remains unchanged - it only uses the `LumaClient` interface
 * 
 * SECURITY:
 * - API key is held in memory only, never persisted
 * - Direct client should ONLY be used in development
 * - Production should use a backend proxy that holds the key server-side
 */

import type {
  LumaEvent,
  LumaEventsResponse,
  LumaGuest,
  LumaGuestsResponse,
  LumaGuestEntry
} from './types';

// =============================================================================
// CLIENT INTERFACE
// =============================================================================

/**
 * Abstract interface for Luma API access.
 * Implementations can be direct API calls or backend proxy calls.
 */
export interface LumaClient {
  /**
   * Test if the client is configured and authenticated.
   */
  isConfigured(): boolean;

  /**
   * List events from the authenticated Luma account.
   */
  listEvents(): Promise<LumaEvent[]>;

  /**
   * Get a single event by API ID.
   */
  getEvent(eventApiId: string): Promise<LumaEvent | null>;

  /**
   * List all guests for an event (handles pagination automatically).
   */
  listGuests(eventApiId: string): Promise<LumaGuest[]>;
}

// =============================================================================
// DIRECT CLIENT IMPLEMENTATION (Development Only)
// =============================================================================

const LUMA_API_BASE = 'https://api.lu.ma/public/v2';

/**
 * Direct Luma API client - calls Luma API directly from browser.
 * 
 * WARNING: Only for development. In production, use a backend proxy.
 * The API key grants full account access and must never be exposed in client code.
 */
export class DirectLumaClient implements LumaClient {
  private apiKey: string | null = null;

  /**
   * Set the API key. Call this before making any API calls.
   * The key is held in memory only.
   */
  setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  /**
   * Clear the API key from memory.
   */
  clearApiKey(): void {
    this.apiKey = null;
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Luma API key not configured. Call setApiKey() first.');
    }

    const url = new URL(`${LUMA_API_BASE}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-luma-api-key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('Invalid Luma API key');
      }
      if (response.status === 403) {
        throw new Error('Luma API access denied. Ensure you have a Luma Plus subscription.');
      }
      if (response.status === 404) {
        throw new Error('Resource not found');
      }
      throw new Error(`Luma API error: ${response.status} ${response.statusText}. ${errorBody}`);
    }

    return response.json();
  }

  async listEvents(): Promise<LumaEvent[]> {
    const events: LumaEvent[] = [];
    let cursor: string | undefined;

    // Paginate through all events
    do {
      const params: Record<string, string> = {};
      if (cursor) {
        params.pagination_cursor = cursor;
      }

      const response = await this.fetch<LumaEventsResponse>('/event/get-events', params);
      
      for (const entry of response.entries) {
        events.push(entry.event);
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    return events;
  }

  async getEvent(eventApiId: string): Promise<LumaEvent | null> {
    try {
      const response = await this.fetch<{ event: LumaEvent }>(`/event/get`, {
        event_api_id: eventApiId
      });
      return response.event;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async listGuests(eventApiId: string): Promise<LumaGuest[]> {
    const guests: LumaGuest[] = [];
    let cursor: string | undefined;

    // Paginate through all guests
    do {
      const params: Record<string, string> = {
        event_api_id: eventApiId
      };
      if (cursor) {
        params.pagination_cursor = cursor;
      }

      const response = await this.fetch<LumaGuestsResponse>('/event/get-guests', params);
      
      for (const entry of response.entries) {
        guests.push(entry.guest);
      }

      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    return guests;
  }
}

// =============================================================================
// BACKEND CLIENT IMPLEMENTATION (For Future Use)
// =============================================================================

/**
 * Backend proxy Luma client - calls your backend which holds the API key.
 * 
 * IMPLEMENTATION NOTES:
 * - Your backend endpoint should accept the same parameters
 * - Backend should validate user authentication (e.g., Clerk)
 * - Backend should hold the Luma API key securely
 * - Backend should proxy requests to Luma and return the same response shape
 * 
 * Example backend endpoints:
 * - GET /api/luma/events
 * - GET /api/luma/events/:eventApiId
 * - GET /api/luma/events/:eventApiId/guests
 */
export class BackendLumaClient implements LumaClient {
  private backendUrl: string;

  constructor(backendUrl: string = '/api/luma') {
    this.backendUrl = backendUrl;
  }

  isConfigured(): boolean {
    // Backend client is always "configured" - auth is handled by the backend
    return true;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.backendUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
        // Backend will use session/token auth instead of API key
      },
      credentials: 'include' // Send cookies for session auth
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Backend error: ${response.status} ${response.statusText}. ${errorBody}`);
    }

    return response.json();
  }

  async listEvents(): Promise<LumaEvent[]> {
    return this.fetch<LumaEvent[]>('/events');
  }

  async getEvent(eventApiId: string): Promise<LumaEvent | null> {
    try {
      return this.fetch<LumaEvent>(`/events/${eventApiId}`);
    } catch {
      return null;
    }
  }

  async listGuests(eventApiId: string): Promise<LumaGuest[]> {
    return this.fetch<LumaGuest[]>(`/events/${eventApiId}/guests`);
  }
}

// =============================================================================
// SINGLETON CLIENT INSTANCE
// =============================================================================

/**
 * Global Luma client instance.
 * 
 * In development: Uses DirectLumaClient (requires setApiKey())
 * In production: Should be replaced with BackendLumaClient
 * 
 * To switch to backend:
 * export const lumaClient: LumaClient = new BackendLumaClient();
 */
export const lumaClient: LumaClient = new DirectLumaClient();

/**
 * Helper to set the API key on the direct client.
 * Only works when using DirectLumaClient.
 */
export function setLumaApiKey(key: string): void {
  if (lumaClient instanceof DirectLumaClient) {
    lumaClient.setApiKey(key);
  } else {
    console.warn('setLumaApiKey() has no effect when using BackendLumaClient');
  }
}

/**
 * Helper to clear the API key from memory.
 */
export function clearLumaApiKey(): void {
  if (lumaClient instanceof DirectLumaClient) {
    lumaClient.clearApiKey();
  }
}
