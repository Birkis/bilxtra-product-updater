import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { ThuleDownloadRecord } from '$lib/types';
import type { PageServerLoad } from './$types';

// Check if environment variables are set
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

export const load: PageServerLoad = async () => {
    const { data: downloads, error } = await supabase
        .from('thule_downloads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching download history:', error);
        return {
            downloads: []
        };
    }

    return {
        downloads: downloads as ThuleDownloadRecord[]
    };
};

export const actions = {
    recordDownload: async ({ request }) => {
        const data = await request.formData();
        const record = {
            file_name: data.get('file_name') as string,
            file_size: parseInt(data.get('file_size') as string),
            file_type: data.get('file_type') as 'product' | 'car',
            status: 'success' as const
        };

        const { error } = await supabase
            .from('thule_downloads')
            .insert(record);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    }
}; 