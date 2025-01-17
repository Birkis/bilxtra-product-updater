import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// Server-side Supabase client with admin privileges
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
}); 