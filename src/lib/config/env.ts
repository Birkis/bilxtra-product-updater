import { SUPABASE_URL, SUPABASE_SERVICE_ROLE, OPENAI_API_KEY } from '$env/static/private';

export const config = {
    supabase: {
        url: SUPABASE_URL,
        serviceRole: SUPABASE_SERVICE_ROLE
    },
    openai: {
        apiKey: OPENAI_API_KEY
    }
}; 