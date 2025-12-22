
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.45.0';

const DEFAULT_URL = 'https://wyzcizewwswwnqllzoyl.supabase.co';

// 1. Capture Environment Variables
// Assume process.env is available in the execution context as per guidelines.
const envUrl = process.env.SUPABASE_URL;
const envKey = process.env.SUPABASE_ANON_KEY;

// 2. Capture Runtime Fallback (LocalStorage)
const localUrl = localStorage.getItem('SUPABASE_URL');
const localKey = localStorage.getItem('SUPABASE_ANON_KEY');

/**
 * All required environment variables must be present to skip configuration UI.
 */
export const isEnvConfigured = !!(envUrl && envKey);

/**
 * Returns the configuration to be used by the app.
 * Environment configuration always takes precedence when present.
 * If an environment variable is missing, it falls back to the runtime value (localStorage).
 */
export const getEffectiveConfig = () => {
  return {
    url: envUrl || localUrl || DEFAULT_URL,
    key: envKey || localKey || '',
    source: isEnvConfigured ? 'env' : 'runtime'
  };
};

/**
 * Check if the application has enough information to initialize data calls.
 * True if environment is fully configured OR if runtime fallback is fully configured.
 */
export const hasSupabaseCredentials = () => {
  const { key } = getEffectiveConfig();
  return !!key;
};

const config = getEffectiveConfig();

/**
 * Initialize the client with the determined configuration.
 * CRITICAL: We pass a placeholder string 'required-key' if config.key is empty.
 * This prevents the supabase-js library from throwing an 'Uncaught Error: supabaseKey is required' 
 * during the module evaluation phase, allowing the UI to render the setup screen instead.
 */
export const supabase = createClient(config.url, config.key || 'required-key');

// Placeholder user_id for multi-tenant scoping.
export const USER_ID = 'user_workshop_roi_machine_admin_01';

/**
 * Clears runtime configuration from localStorage and reloads the application.
 */
export const resetRuntimeConfig = () => {
  localStorage.removeItem('SUPABASE_URL');
  localStorage.removeItem('SUPABASE_ANON_KEY');
  window.location.reload();
};
