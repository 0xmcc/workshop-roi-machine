/**
 * Luma Integration Module
 * 
 * Provides integration with Luma's public API for syncing event attendees.
 * 
 * USAGE:
 * ```typescript
 * import { setLumaApiKey, lumaClient, syncLumaEvent } from './services/luma';
 * 
 * // 1. Set API key (development only - in production, use backend)
 * setLumaApiKey('your-api-key');
 * 
 * // 2. List events
 * const events = await lumaClient.listEvents();
 * 
 * // 3. Sync an event's guests to Supabase
 * const result = await syncLumaEvent({
 *   lumaEventApiId: events[0].api_id
 * });
 * ```
 * 
 * BACKEND MIGRATION:
 * When ready to move to a backend:
 * 1. Create backend endpoints that proxy Luma API calls
 * 2. Replace DirectLumaClient with BackendLumaClient in client.ts
 * 3. Application code remains unchanged
 */

// Re-export everything for convenient imports
export * from './types';
export * from './client';
export * from './sync';
