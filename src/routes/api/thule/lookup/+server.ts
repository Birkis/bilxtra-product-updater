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
        // Extract just the number if it's a kit ID (format: "Thule Kit 145219")
        const cleanSku = sku.includes('Kit') ? sku.split(' ').pop() || sku : sku;
        const searchSku = `THU-${cleanSku}`;
        console.log('Searching for product URL with SKU:', searchSku, '(original:', sku, ')');
        
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
    position?: 'front' | 'rear';  // Optional field for rack position
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
    inferred?: {
        message: string;
        detected: {
            variation: string;
            doors: string;
        };
        original: {
            variation: string | null;
            doors: string;
        };
    };
}

interface ProductMatch {
    score: number;
    hasCompleteSolution: boolean;
    hasFullComponentSet: boolean;
    hasBothRacks: boolean;
    match: any;
}

function scoreMatch(match: any): ProductMatch {
    let score = 0;
    let componentCount = 0;
    
    // Check for complete solutions (highest priority)
    const hasFrontRack = !!match['Complete Front Rack ID'];
    const hasRearRack = !!match['Complete Rear Rack ID'];
    
    // Give extra points for having both front and rear racks
    if (hasFrontRack && hasRearRack) {
        score += 8; // Higher score for complete set
    } else if (hasFrontRack || hasRearRack) {
        score += 3; // Original score for single rack
    }
    
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
        hasCompleteSolution: hasFrontRack || hasRearRack,
        hasFullComponentSet: componentCount === 3, // All individual components present
        hasBothRacks: hasFrontRack && hasRearRack, // New flag for having both racks
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
        hasBothRacks: m.hasBothRacks,
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
    
    // Check for complete rack solutions
    const completeRacks: Product[] = [];
    
    if (match['Complete Front Rack ID']) {
        const frontRackUrl = await getProductUrl(match['Complete Front Rack ID'], requestUrl);
        completeRacks.push({
            sku: match['Complete Front Rack ID'],
            type: 'complete_rack',
            url: frontRackUrl,
            name: match['Complete Front Rack Name'] || '',
            position: 'front'
        });
    }
    
    if (match['Complete Rear Rack ID']) {
        const rearRackUrl = await getProductUrl(match['Complete Rear Rack ID'], requestUrl);
        completeRacks.push({
            sku: match['Complete Rear Rack ID'],
            type: 'complete_rack',
            url: rearRackUrl,
            name: match['Complete Rear Rack Name'] || '',
            position: 'rear'
        });
    }
    
    if (completeRacks.length > 0) {
        groups.push({
            type: 'complete_rack',
            isPreferred: true,
            products: completeRacks
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
            isPreferred: !completeRacks.length,  // Preferred only if no complete racks
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

        // Validate required parameters (except variation)
        if (!make || !model || !year || !doors) {
            console.warn('Missing required parameters:', { make, model, year, doors });
            return json({
                success: false,
                productGroups: [],
                message: 'Missing required parameters',
                query: { make, model, year, doors, variation: carVariation }
            });
        }

        // Log search parameters
        console.log('Searching for car:', { make, model, year, doors, variation: carVariation });

        // First, try to find matches without door restriction
        let { data: matches, error: dbError } = await supabase
            .from('car_fits')
            .select('*')
            .ilike('"Car Make"', make)
            .ilike('"Car Model"', model);

        if (dbError) {
            console.error('Database error:', dbError);
            throw error(500, 'Failed to process request');
        }

        // Filter matches by year range
        matches = matches?.filter(match => {
            const startYear = parseInt(match['Car Start Year']);
            const endYear = parseInt(match['Car Stop Year'] || '9999');
            return year >= startYear && year <= endYear;
        }) || [];

        console.log(`Found ${matches.length} initial matches`);

        let bestMatch = null;
        let inferredVariation = false;
        let inferredDoors = false;

        // Try exact door and variation match first
        if (matches.length > 0) {
            let filteredMatches = matches.filter(m => m['Number of Doors'] === doors);
            
            if (carVariation && VALID_CAR_VARIATIONS.has(carVariation)) {
                const exactMatches = filteredMatches.filter(m => m['Car Variation'] === carVariation);
                bestMatch = findBestMatch(exactMatches);
            }
            
            // If no match with exact variation, try all variations but keep door restriction
            if (!bestMatch && filteredMatches.length > 0) {
                inferredVariation = true;
                bestMatch = findBestMatch(filteredMatches);
            }
            
            // If still no match, try without door restriction
            if (!bestMatch) {
                inferredDoors = true;
                if (carVariation && VALID_CAR_VARIATIONS.has(carVariation)) {
                    const doorlessMatches = matches.filter(m => m['Car Variation'] === carVariation);
                    bestMatch = findBestMatch(doorlessMatches);
                }
                
                // If still no match, try all variations without door restriction
                if (!bestMatch) {
                    inferredVariation = true;
                    bestMatch = findBestMatch(matches);
                }
            }
        }

        if (!bestMatch) {
            console.warn('No matches found for car');
            return json({
                success: false,
                productGroups: [],
                message: 'No matches found for the specified car',
                query: { make, model, year, doors, variation: carVariation }
            });
        }

        // Create product groups from best match
        const productGroups = await createProductGroup(bestMatch, url);

        // Prepare response
        const response: ThuleLookupResponse = {
            success: true,
            car: {
                make: bestMatch['Car Make'],
                model: bestMatch['Car Model'],
                variation: bestMatch['Car Variation'],
                doors: bestMatch['Number of Doors'],
                yearRange: {
                    start: parseInt(bestMatch['Car Start Year']),
                    end: parseInt(bestMatch['Car Stop Year'] || '9999')
                }
            },
            productGroups,
            k_type: bestMatch['K-TYPE'] ? [bestMatch['K-TYPE']] : []
        };

        // Add inference notes
        if (inferredVariation || inferredDoors) {
            response.inferred = {
                message: inferredVariation && inferredDoors 
                    ? "Rail type and door configuration were automatically detected"
                    : inferredVariation 
                        ? "Rail type was automatically detected"
                        : "Door configuration was automatically detected",
                detected: {
                    variation: bestMatch['Car Variation'],
                    doors: bestMatch['Number of Doors']
                },
                original: {
                    variation: carVariation || null,
                    doors: doors
                }
            };
        }

        return json(response);

    } catch (err) {
        console.error('Error processing request:', err);
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
        }, { status: 500 });
    }
} 