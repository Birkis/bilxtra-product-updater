import { json } from '@sveltejs/kit';
import { config } from '$lib/config/env';

export async function GET() {
    try {
        // Test if we can access our config
        const configTest = {
            supabaseUrlSet: !!config.supabase.url,
            supabaseServiceRoleSet: !!config.supabase.serviceRole,
            openaiApiKeySet: !!config.openai.apiKey
        };
        
        return json({
            success: true,
            config: configTest
        });
    } catch (error) {
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 