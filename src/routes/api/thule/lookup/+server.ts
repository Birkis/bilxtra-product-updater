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

// Define response types for better documentation
interface CarInfo {
    make: string;
    model: string;
    variation: string;
    doors: string;
    yearRange: {
        start: number;
        end: number;
    };
}

interface Product {
    sku: string;
    type: 'bar' | 'foot' | 'kit' | 'complete_rack';
    url: string | null;
    name: string;
}

interface ProductGroup {
    type: 'complete_rack' | 'individual_components';
    isPreferred: boolean;
    products: Product[];
}

interface ThuleLookupResponse {
    success: boolean;
    car: CarInfo;
    productGroups: ProductGroup[];
    k_type: string[];
    error?: string;
}

interface ProductMatch {
    score: number;
    hasCompleteSolution: boolean;
    hasFullComponentSet: boolean;
    match: any;
}

function scoreMatch(match: any): ProductMatch {
    let score = 0;
    let componentCount = 0;
    
    // Check for complete solutions (highest priority)
    const hasCompleteFront = !!match['Complete Front Rack ID'];
    const hasCompleteRear = !!match['Complete Rear Rack ID'];
    if (hasCompleteFront) score += 3;
    if (hasCompleteRear) score += 3;
    
    // Check for individual components
    const hasBar = !!match['Bar ID'];
    const hasFoot = !!match['Foot ID'];
    const hasKit = !!match['RackSolution Kit ID'];
    
    if (hasBar) {
        score += 1;
        componentCount++;
    }
    if (hasFoot) {
        score += 1;
        componentCount++;
    }
    if (hasKit) {
        score += 1;
        componentCount++;
    }
    
    return {
        score,
        hasCompleteSolution: hasCompleteFront || hasCompleteRear,
        hasFullComponentSet: componentCount === 3, // All individual components present
        match
    };
}

function findBestMatch(matches: any[]): any {
    if (!matches || matches.length === 0) return null;
    
    // Score all matches
    const scoredMatches = matches.map(match => scoreMatch(match));
    
    // Sort by:
    // 1. Highest score
    // 2. Complete solution preferred
    // 3. Full component set preferred
    scoredMatches.sort((a, b) => {
        // First, compare scores
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        
        // If scores are equal, prefer complete solutions
        if (a.hasCompleteSolution !== b.hasCompleteSolution) {
            return a.hasCompleteSolution ? -1 : 1;
        }
        
        // If neither has complete solution, prefer full component sets
        if (a.hasFullComponentSet !== b.hasFullComponentSet) {
            return a.hasFullComponentSet ? -1 : 1;
        }
        
        return 0;
    });
    
    console.log('Scored matches:', scoredMatches.map(m => ({
        score: m.score,
        hasCompleteSolution: m.hasCompleteSolution,
        hasFullComponentSet: m.hasFullComponentSet,
        products: {
            completeFront: m.match['Complete Front Rack ID'],
            completeRear: m.match['Complete Rear Rack ID'],
            bar: m.match['Bar ID'],
            foot: m.match['Foot ID'],
            kit: m.match['RackSolution Kit ID']
        }
    })));
    
    return scoredMatches[0].match;
}

async function createProductGroup(match: any, requestUrl: URL): Promise<ProductGroup[]> {
    const groups: ProductGroup[] = [];
    
    // Check for complete rack solution
    if (match['Complete Front Rack ID']) {
        const completeRackUrl = await getProductUrl(match['Complete Front Rack ID'], requestUrl);
        groups.push({
            type: 'complete_rack',
            isPreferred: true,
            products: [{
                sku: match['Complete Front Rack ID'],
                type: 'complete_rack',
                url: completeRackUrl,
                name: match['Complete Front Rack Name'] || ''
            }]
        });
    }
    
    // Check for individual components
    const individualProducts: Product[] = [];
    
    if (match['Bar ID']) {
        const barUrl = await getProductUrl(match['Bar ID'], requestUrl);
        individualProducts.push({
            sku: match['Bar ID'],
            type: 'bar',
            url: barUrl,
            name: match['Bar Name'] || ''
        });
    }
    
    if (match['Foot ID']) {
        const footUrl = await getProductUrl(match['Foot ID'], requestUrl);
        individualProducts.push({
            sku: match['Foot ID'],
            type: 'foot',
            url: footUrl,
            name: match['Foot Name'] || ''
        });
    }
    
    if (match['RackSolution Kit ID']) {
        const kitUrl = await getProductUrl(match['RackSolution Kit ID'], requestUrl);
        individualProducts.push({
            sku: match['RackSolution Kit ID'],
            type: 'kit',
            url: kitUrl,
            name: match['RackSolution Kit Name'] || ''
        });
    }
    
    if (individualProducts.length > 0) {
        groups.push({
            type: 'individual_components',
            isPreferred: !match['Complete Front Rack ID'],  // Preferred only if no complete rack
            products: individualProducts
        });
    }
    
    return groups;
}

export async function GET({ url }) {
    try {
        console.log('=== Starting car lookup ===');
        
        // Get and log query parameters
        const make = url.searchParams.get('make')?.trim();
        const model = url.searchParams.get('model')?.trim();
        const year = parseInt(url.searchParams.get('year') || '');
        const doors = url.searchParams.get('doors')?.trim();
        const carVariation = url.searchParams.get('variation')?.trim();

        // Validate required parameters
        if (!make || !model || !year || !doors || !carVariation) {
            console.log('Missing required parameters:', { make, model, year, doors, carVariation });
            return json({
                success: false,
                productGroups: [],
                message: 'Missing required parameters',
                query: { make, model, year, doors, variation: carVariation }
            });
        }

        console.log('Query parameters:', { make, model, year, doors, carVariation });

        // First, let's get distinct values to understand our data
        console.log('Fetching distinct door types...');
        const { data: doorTypes } = await supabase
            .from('car_fits')
            .select('"Number of Doors"')
            .not('Number of Doors', 'is', null);
        
        console.log('Fetching distinct car variations...');
        const { data: carVariations } = await supabase
            .from('car_fits')
            .select('"Car Variation"')
            .not('Car Variation', 'is', null);

        // Create sets of unique values
        const uniqueDoorTypes = new Set(doorTypes?.map(d => d['Number of Doors']));
        const uniqueCarVariations = new Set(carVariations?.map(c => c['Car Variation']));

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
            .ilike('"Car Make"', make)
            .ilike('"Car Model"', model)
            .eq('"Number of Doors"', doors)
            .eq('"Car Variation"', carVariation)
            .lte('"Car Start Year"', year)
            .or(`"Car Stop Year".is.null,"Car Stop Year".gte.${year}`);

        if (queryError) {
            console.error('Database query error:', queryError);
            throw error(500, { message: queryError.message });
        }

        console.log(`Found ${matches?.length || 0} potential matches`);
        
        // Log each match with detailed information
        if (matches && matches.length > 0) {
            matches.forEach((match, index) => {
                console.log(`Match ${index + 1}:`, {
                    make: match['Car Make'],
                    model: match['Car Model'],
                    doors: match['Number of Doors'],
                    variation: match['Car Variation'],
                    yearRange: {
                        start: match['Car Start Year'],
                        end: match['Car Stop Year'],
                        requestedYear: year,
                        isInRange: year >= match['Car Start Year'] && year <= match['Car Stop Year']
                    },
                    exactMatches: {
                        make: match['Car Make'].toLowerCase() === make.toLowerCase(),
                        model: match['Car Model'].toLowerCase() === model.toLowerCase(),
                        doors: match['Number of Doors'] === doors,
                        variation: match['Car Variation'] === carVariation
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
                .or(`"Car Make".ilike.%${make}%,"Car Model".ilike.%${model}%`)
                .order('"Car Make"', { ascending: true });

            if (broadMatches && broadMatches.length > 0) {
                console.log('Found similar matches:', broadMatches.map(m => ({
                    make: m['Car Make'],
                    model: m['Car Model'],
                    doors: m['Number of Doors'],
                    variation: m['Car Variation'],
                    yearRange: `${m['Car Start Year']}-${m['Car Stop Year']}`
                })));
            }

            return json({
                success: false,
                productGroups: [],
                message: 'No matching car found',
                query: { make, model, year, doors, variation: carVariation },
                debug: {
                    availableDoorTypes: Array.from(uniqueDoorTypes),
                    availableCarVariations: Array.from(uniqueCarVariations),
                    validCarVariations: Array.from(VALID_CAR_VARIATIONS),
                    similarMatches: broadMatches?.map(m => ({
                        make: m['Car Make'],
                        model: m['Car Model'],
                        doors: m['Number of Doors'],
                        variation: m['Car Variation'],
                        yearRange: `${m['Car Start Year']}-${m['Car Stop Year']}`
                    }))
                }
            });
        }

        // Find the best match instead of just taking the first one
        const data = findBestMatch(matches);
        if (!data) {
            return json({
                success: false,
                productGroups: [],
                message: 'No suitable match found',
                query: { make, model, year, doors, variation: carVariation }
            });
        }
        
        // Create product groups from the match
        const productGroups = await createProductGroup(data, url);
        
        // Format the response according to the new schema
        const response: ThuleLookupResponse = {
            success: true,
            car: {
                make: data['Car Make'],
                model: data['Car Model'],
                variation: data['Car Variation'],
                doors: data['Number of Doors'].toString(),
                yearRange: {
                    start: data['Car Start Year'],
                    end: data['Car Stop Year']
                }
            },
            productGroups,
            k_type: data['K-TYPE'] || []
        };

        return json(response);
    } catch (error) {
        console.error('Error in Thule lookup:', error);
        return json({
            success: false,
            error: 'Failed to process request',
            car: {
                make: '',
                model: '',
                variation: '',
                doors: '',
                yearRange: { start: 0, end: 0 }
            },
            productGroups: [],
            k_type: []
        } as ThuleLookupResponse, { status: 500 });
    }
} 