import { supabase } from '$lib/db/supabaseClient';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    // Query for exact Audi e-tron matches
    const { data: exactMatches, error: exactError } = await supabase
        .from('car_fits')
        .select('*')
        .eq('Car Make', 'AUDI')
        .ilike('Car Model', 'e-tron')
        .not('Car Model', 'ilike', '%sportback%')
        .not('Car Model', 'ilike', '%gt%');

    // Query for all e-tron variants
    const { data: allVariants, error: variantsError } = await supabase
        .from('car_fits')
        .select('*')
        .eq('Car Make', 'AUDI')
        .ilike('Car Model', '%e-tron%');

    if (exactError || variantsError) {
        return new Response(JSON.stringify({ 
            error: 'Database query failed',
            exactError,
            variantsError
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
        exactMatches: exactMatches?.map(m => ({
            model: m['Car Model'],
            year: { start: m['Car Start Year'], end: m['Car Stop Year'] },
            variation: m['Car Variation'],
            products: {
                completeFront: m['Complete Front Rack ID'],
                completeRear: m['Complete Rear Rack ID'],
                bar: m['Bar ID'],
                foot: m['Foot ID'],
                kit: m['RackSolution Kit ID']
            }
        })),
        allVariants: allVariants?.map(m => ({
            model: m['Car Model'],
            year: { start: m['Car Start Year'], end: m['Car Stop Year'] },
            variation: m['Car Variation'],
            products: {
                completeFront: m['Complete Front Rack ID'],
                completeRear: m['Complete Rear Rack ID'],
                bar: m['Bar ID'],
                foot: m['Foot ID'],
                kit: m['RackSolution Kit ID']
            }
        }))
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}; 