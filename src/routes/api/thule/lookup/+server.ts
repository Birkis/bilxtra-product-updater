import { error, json } from '@sveltejs/kit';
import { supabase } from '../../../../lib/db/supabaseClient';

// Known valid car variations
const VALID_CAR_VARIATIONS = new Set([
    'med integrerte relinger',
    'med takrenner, med høyt tak',
    'med takrenner',
    'med normalt tak',
    'med integrerte relinger og klemfot',
    'med normalt tak uten glasstak',
    'med T-profil',
    'Integrerte relinger og festepunktfot',
    'med faste punkter',
    'med takskinner',
    'med hevede skinner',
    'med faste punkter, uten glasstak',
    'med faste punkter, med høyt tak',
    'med fabrikkinstallert tverrstang'
]);

async function getProductUrl(sku: string, requestUrl: URL): Promise<string | null> {
    try {
        const searchSku = `THU-${sku}`;
        console.log('Searching for product URL with SKU:', searchSku);
        
        // Use the same origin as the current request
        const productSearchUrl = new URL('/api/product-search', requestUrl.origin);
        productSearchUrl.searchParams.set('q', searchSku);
        
        console.log('Making request to:', productSearchUrl.toString());
        const response = await fetch(productSearchUrl);
        if (!response.ok) {
            console.warn(`Failed to fetch product URL for SKU ${searchSku}:`, response.statusText);
            return null;
        }
        
        const results = await response.json();
        console.log('Product search results:', JSON.stringify(results, null, 2));
        
        if (results && results.length > 0) {
            console.log('Found product URL:', results[0].url);
            return results[0].url;
        }
        
        console.warn('No product URL found for SKU:', searchSku);
        return null;
    } catch (err) {
        console.error('Error fetching product URL:', err);
        return null;
    }
}

export async function GET({ url }) {
    try {
        console.log('=== Starting car lookup ===');
        
        // Get and log query parameters
        const make = url.searchParams.get('make')?.trim();
        const model = url.searchParams.get('model')?.trim();
        const year = parseInt(url.searchParams.get('year') || '0');
        const doors = url.searchParams.get('doors')?.trim();
        const carVariation = url.searchParams.get('variation')?.trim();

        // Validate required parameters
        if (!make || !model || !year || !doors || !carVariation) {
            console.log('Missing required parameters:', { make, model, year, doors, carVariation });
            return json({
                success: false,
                products: [],
                message: 'Missing required parameters',
                query: { make, model, year, doors, variation: carVariation }
            });
        }

        console.log('Query parameters:', { make, model, year, doors, carVariation });

        // First, let's get distinct values to understand our data
        console.log('Fetching distinct door types...');
        const { data: doorTypes } = await supabase
            .from('car_fits')
            .select('number_of_doors')
            .not('number_of_doors', 'is', null);
        
        console.log('Fetching distinct car variations...');
        const { data: carVariations } = await supabase
            .from('car_fits')
            .select('car_variation')
            .not('car_variation', 'is', null);

        // Create sets of unique values
        const uniqueDoorTypes = new Set(doorTypes?.map(d => d.number_of_doors));
        const uniqueCarVariations = new Set(carVariations?.map(c => c.car_variation));

        // Log unique values
        console.log('Unique door types:', Array.from(uniqueDoorTypes));
        console.log('Unique car variations:', Array.from(uniqueCarVariations));
        console.log('Requested variation exists in known values:', VALID_CAR_VARIATIONS.has(carVariation));

        // Log search criteria
        console.log('Searching with criteria:', {
            make,
            model,
            year,
            doors,
            carVariation
        });

        // Now try to find matches for this specific car
        console.log('Searching for car matches...');
        const { data: matches, error: queryError } = await supabase
            .from('car_fits')
            .select('*')
            .ilike('car_make', make)
            .ilike('car_model', model)
            .eq('number_of_doors', doors)
            .eq('car_variation', carVariation)
            .lte('car_start_year', year)
            .gte('car_stop_year', year);

        if (queryError) {
            console.error('Database query error:', queryError);
            throw error(500, { message: queryError.message });
        }

        console.log(`Found ${matches?.length || 0} potential matches`);
        
        // Log each match with detailed information
        if (matches && matches.length > 0) {
            matches.forEach((match, index) => {
                console.log(`Match ${index + 1}:`, {
                    make: match.car_make,
                    model: match.car_model,
                    doors: match.number_of_doors,
                    variation: match.car_variation,
                    yearRange: {
                        start: match.car_start_year,
                        end: match.car_stop_year,
                        requestedYear: year,
                        isInRange: year >= match.car_start_year && year <= match.car_stop_year
                    },
                    exactMatches: {
                        make: match.car_make.toLowerCase() === make.toLowerCase(),
                        model: match.car_model.toLowerCase() === model.toLowerCase(),
                        doors: match.number_of_doors === doors,
                        variation: match.car_variation === carVariation
                    }
                });
            });
        }

        // If no exact matches, try a broader search to help with debugging
        if (!matches || matches.length === 0) {
            console.log('No exact matches, trying broader search...');
            const { data: broadMatches } = await supabase
                .from('car_fits')
                .select('*')
                .or(`car_make.ilike.%${make}%,car_model.ilike.%${model}%`)
                .order('car_make', { ascending: true });

            if (broadMatches && broadMatches.length > 0) {
                console.log('Found similar matches:', broadMatches.map(m => ({
                    make: m.car_make,
                    model: m.car_model,
                    doors: m.number_of_doors,
                    variation: m.car_variation,
                    yearRange: `${m.car_start_year}-${m.car_stop_year}`
                })));
            }

            return json({
                success: false,
                products: [],
                message: 'No matching car found',
                query: { make, model, year, doors, variation: carVariation },
                debug: {
                    availableDoorTypes: Array.from(uniqueDoorTypes),
                    availableCarVariations: Array.from(uniqueCarVariations),
                    validCarVariations: Array.from(VALID_CAR_VARIATIONS),
                    similarMatches: broadMatches?.map(m => ({
                        make: m.car_make,
                        model: m.car_model,
                        doors: m.number_of_doors,
                        variation: m.car_variation,
                        yearRange: `${m.car_start_year}-${m.car_stop_year}`
                    }))
                }
            });
        }

        // Use the first match
        const data = matches[0];
        
        // Transform the data into product URLs
        const products = [];
        
        // Add each product ID if it exists and fetch its URL
        if (data.complete_front_rack_id) {
            const productUrl = await getProductUrl(data.complete_front_rack_id, url);
            products.push({
                sku: data.complete_front_rack_id,
                url: productUrl || `https://bilxtra.no/${data.complete_front_rack_id}`,
                type: 'complete_front_rack'
            });
        }
        
        if (data.bar_id) {
            const productUrl = await getProductUrl(data.bar_id, url);
            products.push({
                sku: data.bar_id,
                url: productUrl || `https://bilxtra.no/${data.bar_id}`,
                type: 'bar'
            });
        }
        
        if (data.foot_id) {
            const productUrl = await getProductUrl(data.foot_id, url);
            products.push({
                sku: data.foot_id,
                url: productUrl || `https://bilxtra.no/${data.foot_id}`,
                type: 'foot'
            });
        }
        
        if (data.adapter_id) {
            const productUrl = await getProductUrl(data.adapter_id, url);
            products.push({
                sku: data.adapter_id,
                url: productUrl || `https://bilxtra.no/${data.adapter_id}`,
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
                variation: data.car_variation,
                doors: data.number_of_doors,
                yearRange: {
                    start: data.car_start_year,
                    end: data.car_stop_year
                }
            },
            debug: {
                query: { make, model, year, doors, variation: carVariation },
                matchDetails: {
                    make: data.car_make,
                    model: data.car_model,
                    doors: data.number_of_doors,
                    variation: data.car_variation,
                    yearRange: {
                        start: data.car_start_year,
                        end: data.car_stop_year,
                        requestedYear: year,
                        isInRange: year >= data.car_start_year && year <= data.car_stop_year
                    },
                    exactMatches: {
                        make: data.car_make.toLowerCase() === make?.toLowerCase(),
                        model: data.car_model.toLowerCase() === model?.toLowerCase(),
                        doors: data.number_of_doors === doors,
                        variation: data.car_variation === carVariation
                    }
                },
                availableDoorTypes: Array.from(uniqueDoorTypes),
                availableCarVariations: Array.from(uniqueCarVariations),
                validCarVariations: Array.from(VALID_CAR_VARIATIONS)
            }
        });

    } catch (err) {
        console.error('Thule lookup error:', {
            error: err,
            message: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined
        });
        throw error(500, { message: err instanceof Error ? err.message : 'Unknown error' });
    }
} 