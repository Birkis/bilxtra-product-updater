/**
 * Shared Supabase client for server-side operations.
 * This client uses the service role key and should only be used in server-side code.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from '$env/static/private';

if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is not set');
}

if (!SUPABASE_SERVICE_ROLE) {
    throw new Error('SUPABASE_SERVICE_ROLE environment variable is not set');
}

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE
); 