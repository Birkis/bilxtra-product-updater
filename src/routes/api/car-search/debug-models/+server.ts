import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabase } from '$lib/db/supabaseClient';

export async function GET({ request }: RequestEvent) {
    try {
        const { data: models, error } = await supabase
            .from('car_data')
            .select('model')
            .eq('make', 'BMW')
            .order('model');

        if (error) {
            throw error;
        }

        // Remove duplicates using Set
        const uniqueModels = [...new Set(models.map(m => m.model))];

        return json({
            success: true,
            models: uniqueModels
        });

    } catch (err) {
        console.error('Error fetching models:', err);
        return json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 });
    }
} 