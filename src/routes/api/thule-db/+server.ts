import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export async function GET({ url }) {
    try {
        const make = url.searchParams.get('make');
        const model = url.searchParams.get('model');
        const year = url.searchParams.get('year');

        let query = supabaseAdmin
            .from('cars')
            .select(`
                *,
                car_solutions (
                    fit_tips,
                    engineering_comment,
                    fit_status,
                    solutions (
                        solution_id,
                        solution_type,
                        solution_name,
                        solution_products (
                            products (
                                product_id,
                                product_name,
                                product_type,
                                status_erp,
                                webtitle1,
                                color,
                                dimensions,
                                data_product_image
                            )
                        )
                    )
                )
            `);

        // Apply filters if provided
        if (make) {
            query = query.ilike('car_make', `%${make}%`);
        }
        if (model) {
            query = query.ilike('car_model', `%${model}%`);
        }
        if (year) {
            const yearNum = parseInt(year);
            query = query
                .lte('car_start_year', yearNum)
                .gte('car_stop_year', yearNum);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Database query error:', error);
            return json({ error: 'Failed to fetch data' }, { status: 500 });
        }

        return json(data);
    } catch (error) {
        console.error('API error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
} 