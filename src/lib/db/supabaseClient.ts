/**
 * Shared Supabase client for server-side operations.
 * This client uses the service role key and should only be used in server-side code.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE
); 