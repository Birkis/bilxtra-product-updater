import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export async function POST() {
    try {
        const { data, error } = await supabaseAdmin
            .from('thule_downloads')
            .insert({
                file_name: 'test-file.csv',
                file_type: 'product',
                file_size: 1024,
                status: 'success'
            })
            .select()
            .single();

        if (error) throw error;

        return json({ success: true, data });
    } catch (err) {
        const error = err as Error;
        console.error('Error inserting test record:', error);
        return json({ success: false, error: error.message }, { status: 500 });
    }
} 