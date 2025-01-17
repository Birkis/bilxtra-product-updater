import { error, json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function GET({ url }) {
    try {
        console.log('=== Starting car lookup ===');
        
        // Get and log query parameters
        const make = url.searchParams.get('make');
        const model = url.searchParams.get('model');
        const year = parseInt(url.searchParams.get('year') || '0');
        const doors = url.searchParams.get('doors');
        const carType = url.searchParams.get('type');

        console.log('Raw query parameters:', {
            make,
            model,
            year,
            doors,
            carType,
            searchParams: Object.fromEntries(url.searchParams.entries())
        });

        // Validate required parameters
        if (!make || !model || !year || !doors || !carType) {
            console.log('Missing parameters:', {
                hasMake: !!make,
                hasModel: !!model,
                hasYear: !!year,
                hasDoors: !!doors,
                hasType: !!carType
            });
            throw error(400, 'Missing required parameters');
        }

        // First, let's just get ALL records to see what's in the database
        console.log('Fetching first 10 records to check structure...');
        const { data: sampleData } = await supabase
            .from('car_fits')
            .select('*')
            .limit(10);
        
        if (sampleData && sampleData.length > 0) {
            console.log('Sample record structure:', sampleData[0]);
        }

        // Now let's try to find just by make
        console.log('Searching by make only...');
        const { data: makeMatches } = await supabase
            .from('car_fits')
            .select('*')
            .ilike('car_make', `%${make}%`);

        if (makeMatches && makeMatches.length > 0) {
            console.log(`Found ${makeMatches.length} matches by make:`, 
                makeMatches.map(car => ({
                    make: car.car_make,
                    model: car.car_model
                }))
            );
        } else {
            console.log('No matches found by make');
        }

        // Now try the full search but with more lenient matching
        const { data: allMatches, error: queryError } = await supabase
            .from('car_fits')
            .select('*')
            .ilike('car_make', `%${make}%`)
            .ilike('car_model', `%${model}%`)
            .ilike('number_of_doors', `%${doors}%`)
            .ilike('car_type', `%${carType}%`);

        if (queryError) {
            console.error('Supabase query error:', queryError);
            throw error(500, {
                message: 'Database query failed',
                details: queryError.message
            });
        }

        console.log('Found matches:', allMatches?.length || 0);
        if (allMatches && allMatches.length > 0) {
            console.log('First match:', allMatches[0]);
        }

        if (!allMatches || allMatches.length === 0) {
            return json({
                success: false,
                products: [],
                message: 'No matching car found',
                query: { make, model, year, doors, carType }
            });
        }

        // Use the first match
        const data = allMatches[0];
        
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