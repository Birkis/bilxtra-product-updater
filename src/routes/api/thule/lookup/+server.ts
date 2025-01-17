import { error, json } from '@sveltejs/kit';
import { supabase } from '../../../../lib/db/supabaseClient';

export async function GET({ url }) {
    try {
        console.log('=== Starting car lookup ===');
        
        // Get and log query parameters
        const make = url.searchParams.get('make');
        const model = url.searchParams.get('model');
        const year = parseInt(url.searchParams.get('year') || '0');
        const doors = url.searchParams.get('doors');
        const carType = url.searchParams.get('type');

        console.log('Query parameters:', { make, model, year, doors, carType });

        // First, let's get distinct values to understand our data
        console.log('Fetching distinct door types...');
        const { data: doorTypes } = await supabase
            .from('car_fits')
            .select('number_of_doors')
            .not('number_of_doors', 'is', null);
        
        console.log('Fetching distinct car types...');
        const { data: carTypes } = await supabase
            .from('car_fits')
            .select('car_type')
            .not('car_type', 'is', null);

        // Log unique values
        console.log('Unique door types:', new Set(doorTypes?.map(d => d.number_of_doors)));
        console.log('Unique car types:', new Set(carTypes?.map(c => c.car_type)));

        // Now try to find matches for this specific car
        console.log('Searching for car matches...');
        const { data: matches, error: queryError } = await supabase
            .from('car_fits')
            .select('*')
            .ilike('car_make', `%${make}%`)
            .ilike('car_model', `%${model}%`)
            .ilike('number_of_doors', `%${doors}%`)
            .ilike('car_type', `%${carType}%`);

        if (queryError) {
            console.error('Database query error:', queryError);
            throw error(500, {
                message: 'Database query failed',
                details: queryError.message
            });
        }

        console.log(`Found ${matches?.length || 0} potential matches`);
        if (matches && matches.length > 0) {
            console.log('First match:', matches[0]);
            console.log('Year ranges of matches:', matches.map(m => ({
                make: m.car_make,
                model: m.car_model,
                start: m.car_start_year,
                stop: m.car_stop_year,
                doors: m.number_of_doors,
                type: m.car_type
            })));
        }

        if (!matches || matches.length === 0) {
            return json({
                success: false,
                products: [],
                message: 'No matching car found',
                query: { make, model, year, doors, carType }
            });
        }

        // Use the first match
        const data = matches[0];
        
        // Transform the data into product URLs
        const products = [];
        
        // Add each product ID if it exists
        if (data.complete_front_rack_id) {
            products.push({
                sku: data.complete_front_rack_id,
                url: `https://bilxtra.no/${data.complete_front_rack_id}`,
                type: 'complete_front_rack'
            });
        }
        
        if (data.bar_id) {
            products.push({
                sku: data.bar_id,
                url: `https://bilxtra.no/${data.bar_id}`,
                type: 'bar'
            });
        }
        
        if (data.foot_id) {
            products.push({
                sku: data.foot_id,
                url: `https://bilxtra.no/${data.foot_id}`,
                type: 'foot'
            });
        }
        
        if (data.adapter_id) {
            products.push({
                sku: data.adapter_id,
                url: `https://bilxtra.no/${data.adapter_id}`,
                type: 'adapter'
            });
        }

        return json({
            success: true,
            products,
            k_type: data.k_type,
            car: {
                make: data.car_make,
                model: data.car_model,
                type: data.car_type,
                doors: data.number_of_doors,
                yearRange: {
                    start: data.car_start_year,
                    end: data.car_stop_year
                }
            }
        });

    } catch (err) {
        console.error('Thule lookup error:', {
            error: err,
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined
        });
        throw error(500, {
            message: 'Failed to lookup Thule products',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
} 