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
        
        // Try both with and without THU- prefix since products might be stored either way
        const searchSkus = [
            cleanSku,
            `THU-${cleanSku}`
        ];
        
        for (const searchSku of searchSkus) {
            console.log('Searching for product URL with SKU:', searchSku, '(original:', sku, ')');
            
            // Use the same origin as the current request
            const productSearchUrl = new URL('/api/product-search', requestUrl.origin);
            productSearchUrl.searchParams.set('q', searchSku);
            
            console.log('Making request to:', productSearchUrl.toString());
            const response = await fetch(productSearchUrl);
            if (!response.ok) {
                console.warn(`Failed to fetch product URL for SKU ${searchSku}:`, response.statusText);
                continue;
            }
            
            const results = await response.json();
            console.log('Product search results:', results);
            
            // Check if we have results and get the URL from the correct location
            if (results && results.length > 0 && results[0].url) {
                console.log('Found product URL:', results[0].url);
                return results[0].url;
            }
        }
        
        console.warn('No product URL found for any SKU variation:', searchSkus);
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
    matchConfidence: 'high' | 'medium' | 'low';
    inferred?: {
        message: string;
        detected: {
            variation: string;
        };
        original: {
            variation: string | null;
        };
    };
}

interface ModelSuggestion {
    model: string;
    yearRange: {
        start: number;
        end: number;
    };
    variations: string[];
}

interface ThuleLookupErrorResponse {
    success: false;
    productGroups: [];
    message: string;
    query: {
        make: string | null;
        model: string | null;
        year: number | null;
        variation: string | null;
    };
    suggestions?: {
        make: string;
        models: ModelSuggestion[];
        message: string;
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

// Helper function to normalize strings for comparison
function normalizeString(str: string): string {
    console.log('Normalizing string:', str);
    
    // First normalize manufacturer names
    const normalized = str
        .toUpperCase()
        // Convert common separators to spaces, but preserve hyphens in e-tron, Q4-etron etc
        .replace(/(?<!E|Q[0-9]?)[-_./\\]/g, ' ')
        // Normalize multiple spaces to single space
        .replace(/\s+/g, ' ')
        // Trim spaces
        .trim();
    
    console.log('After initial normalization:', normalized);
    
    // Extract model series for common manufacturers
    const modelSeriesMatch = normalized.match(/^([A-Z])\s*(?:CLASS|KLASSE|SERIES|CLASSE)/i);
    if (modelSeriesMatch) {
        const result = modelSeriesMatch[1].toLowerCase() + 'class';
        console.log('Matched class series:', result);
        return result;
    }
    
    // Extract Mercedes model series from specific variants (e.g., "E 220 CDI" -> "eclass")
    const mercedesMatch = normalized.match(/^([A-Z])\s*\d+/);
    if (mercedesMatch) {
        const result = mercedesMatch[1].toLowerCase() + 'class';
        console.log('Matched Mercedes series:', result);
        return result;
    }
    
    // Special handling for e-tron models
    if (normalized.toLowerCase().includes('e-tron')) {
        const result = normalized
            .toLowerCase()
            // Keep spaces and hyphens for e-tron models
            .replace(/[^\w\d\s-]/g, '')
            .trim();
        console.log('E-tron normalized:', result);
        return result;
    }
    
    // Then do general normalization
    const result = normalized
        .toLowerCase()
        // Now remove all spaces but preserve hyphens in e-tron
        .replace(/\s+/g, '')
        // Remove any remaining special chars except hyphens
        .replace(/[^\w\d-]/g, '');
    
    console.log('Final normalized result:', result);
    return result;
}

// Calculate similarity between two strings (0-1)
function stringSimilarity(str1: string, str2: string): number {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);
    
    if (s1 === s2) return 1;
    
    // Extract numbers from both strings
    const nums1: string[] = s1.match(/\d+/g) || [];
    const nums2: string[] = s2.match(/\d+/g) || [];
    
    // If both strings have numbers but they don't match, reduce similarity
    if (nums1.length > 0 && nums2.length > 0 && 
        !nums1.some(n1 => nums2.includes(n1))) {
        return 0.3;  // Low score for different numbers
    }
    
    // Use Levenshtein distance for better positional matching
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - (distance / maxLength);
    
    // For manufacturer names, be more lenient
    if (str1.toUpperCase() === str1 || str2.toUpperCase() === str2) {
        // Check if one string is a substring of the other (for partial matches like "mercedes" in "mercedes benz")
        const [shorter, longer] = [s1, s2].sort((a, b) => a.length - b.length);
        if (longer.includes(shorter)) {
            return 0.8; // High score for substring matches in manufacturer names
        }
        return similarity > 0.6 ? similarity : similarity * 0.8;
    }
    
    // For other strings, be stricter
    return similarity > 0.8 ? similarity : similarity * 0.7;
}

function levenshteinDistance(s1: string, s2: string): number {
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const matrix: number[][] = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(0));

    for (let i = 0; i <= s2.length; i++) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,  // substitution
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j] + 1       // deletion
                );
            }
        }
    }
    return matrix[s2.length][s1.length];
}

// Helper function to get model suggestions for a manufacturer
function getModelSuggestions(matches: any[], make: string, targetYear: number): ModelSuggestion[] {
    // Get unique models for this manufacturer
    const modelMap = new Map<string, ModelSuggestion>();
    
    matches.forEach(match => {
        const makeSimilarity = stringSimilarity(match['Car Make'], make);
        if (makeSimilarity >= 0.7) {
            const model = match['Car Model'];
            const startYear = parseInt(match['Car Start Year']);
            const endYear = parseInt(match['Car Stop Year'] || '9999');
            
            // Only include models that could be relevant for the target year
            const yearBuffer = 2; // Include models 2 years before/after target year
            if (targetYear >= (startYear - yearBuffer) && targetYear <= (endYear + yearBuffer)) {
                if (!modelMap.has(model)) {
                    modelMap.set(model, {
                        model,
                        yearRange: { start: startYear, end: endYear },
                        variations: [match['Car Variation']]
                    });
                } else {
                    const suggestion = modelMap.get(model)!;
                    if (!suggestion.variations.includes(match['Car Variation'])) {
                        suggestion.variations.push(match['Car Variation']);
                    }
                    // Update year range if needed
                    suggestion.yearRange.start = Math.min(suggestion.yearRange.start, startYear);
                    suggestion.yearRange.end = Math.max(suggestion.yearRange.end, endYear);
                }
            }
        }
    });
    
    return Array.from(modelMap.values());
}

// Common variations to try first
const COMMON_VARIATIONS = [
    'med normalt tak',
    'med integrerte relinger',
    'med takrenner'
];

// Clean and normalize input for matching
function normalizeInput(input: string): string {
    console.log('normalizeInput input:', input);
    const result = input.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')  // Normalize spaces
        .replace(/[-–—]/g, '-'); // Normalize different types of dashes
    console.log('normalizeInput result:', result);
    return result;
}

// Normalize model names for comparison
function normalizeModelName(model: string, make?: string): string {
    console.log('normalizeModelName input:', { model, make });
    const normalized = normalizeInput(model);
    console.log('After normalizeInput:', normalized);
    
    // Special handling for e-tron models
    if (normalized.includes('e-tron')) {
        console.log('Found e-tron model, keeping as is:', normalized);
        // Keep e-tron as is, just normalize spaces and case
        return normalized;
    }
    
    // Special handling for BMW models
    if (make?.toUpperCase() === 'BMW') {
        // Convert specific model numbers to series (e.g., "320" -> "3-series")
        if (/^\d{3}[a-z]?i?$/i.test(normalized)) {
            const series = normalized.charAt(0);
            return `${series}-series`;
        }
        
        // Convert M models to series (e.g., "M4" -> "4-series")
        if (/^m\d{1,2}$/i.test(normalized)) {
            const series = normalized.match(/\d+/)?.[0];
            return `${series}-series`;
        }
        
        // If already in series format, standardize it
        if (normalized.includes('series') || normalized.includes('-series')) {
            return normalized.replace(/(\d+)(?:\s*-?\s*series|er)/i, '$1-series');
        }
        
        // If just a number is provided, assume it's a series
        if (/^\d+$/.test(normalized)) {
            return `${normalized}-series`;
        }
    }
    
    console.log('normalizeModelName result:', normalized);
    return normalized;
}

// Check if two models match
function modelsMatch(inputModel: string, dbModel: string, make?: string): boolean {
    console.log('\nComparing models:', { inputModel, dbModel, make });
    const normalizedInput = normalizeModelName(inputModel, make);
    const normalizedDb = normalizeModelName(dbModel, make);
    
    console.log('After normalization:', {
        normalizedInput,
        normalizedDb
    });
    
    // Exact match after normalization
    if (normalizedInput === normalizedDb) {
        console.log('Exact match after normalization');
        return true;
    }
    
    // For Audi A-series models, require exact matches
    if (make?.toUpperCase() === 'AUDI') {
        const isInputASeries = /^A\d+$/i.test(normalizedInput);
        const isDbASeries = /^A\d+$/i.test(normalizedDb);
        
        if (isInputASeries || isDbASeries) {
            const matches = normalizedInput === normalizedDb;
            console.log('A-series comparison:', { matches });
            return matches;
        }
        
        // For e-tron models
        if (normalizedInput.includes('e-tron') || normalizedDb.includes('e-tron')) {
            console.log('E-tron comparison:', {
                input: normalizedInput,
                db: normalizedDb,
                isBaseModel: normalizedInput === 'e-tron'
            });
            
            // If input is just "e-tron", only match with base e-tron model
            if (normalizedInput === 'e-tron') {
                const matches = normalizedDb === 'e-tron';
                console.log('Base e-tron match:', matches);
                return matches;
            }
            
            // For specific variants, require exact match
            const matches = normalizedInput === normalizedDb;
            console.log('E-tron variant match:', matches);
            return matches;
        }
    }
    
    // For BMW and similar manufacturers with series numbers
    if (make?.toUpperCase() === 'BMW') {
        // Extract series numbers for comparison
        const inputSeries = normalizedInput.match(/^(\d+)-series/i)?.[1];
        const dbSeries = normalizedDb.match(/^(\d+)-series/i)?.[1];
        
        if (inputSeries && dbSeries && inputSeries === dbSeries) {
            return true;
        }
    }
    
    // Fall back to string similarity for backward compatibility
    const similarity = stringSimilarity(inputModel, dbModel);
    return similarity >= 0.7;
}

export async function GET({ url }) {
    try {
        console.log('=== Starting car lookup ===');
        
        // Get and log query parameters
        const make = url.searchParams.get('make')?.trim();
        const model = url.searchParams.get('model')?.trim();
        const year = parseInt(url.searchParams.get('year') || '');
        const carVariation = url.searchParams.get('variation')?.trim();

        // Validate required parameters (except variation)
        if (!make || !model || !year) {
            console.warn('Missing required parameters:', { make, model, year });
            return json({
                success: false,
                productGroups: [],
                message: 'Missing required parameters',
                query: { make, model, year, variation: carVariation }
            });
        }

        // Log search parameters
        console.log('Searching for car:', { make, model, year, variation: carVariation });

        // Get all records and filter with our string similarity
        let { data: matches, error: dbError } = await supabase
            .from('car_fits')
            .select('*')
            .eq('Car Make', make)  // First try exact make match
            .eq('Car Model', model);  // And exact model match

        if (dbError) {
            console.error('Database error:', dbError);
            throw error(500, 'Failed to process request');
        }

        // If no exact matches, try fuzzy matching
        if (!matches || matches.length === 0) {
            console.log('No exact matches, trying fuzzy matching');
            let { data: fuzzyMatches, error: fuzzyError } = await supabase
                .from('car_fits')
                .select('*');

            if (fuzzyError) {
                console.error('Database error:', fuzzyError);
                throw error(500, 'Failed to process request');
            }

            matches = fuzzyMatches;
        } else {
            console.log('Found exact matches:', matches.length);
        }

        // Log all unique manufacturer names for debugging
        const uniqueMakes = new Set(matches?.map(m => m['Car Make']) || []);
        console.log('Found manufacturers:', Array.from(uniqueMakes));
        
        // First filter by make only to get potential suggestions
        const makeMatches = matches?.filter(match => {
            const makeSimilarity = stringSimilarity(match['Car Make'], make);
            console.log(`Make similarity for ${match['Car Make']} vs ${make}: ${makeSimilarity}`);
            return makeSimilarity >= 0.7;
        }) || [];
        
        console.log('Make matches:', makeMatches.map(m => ({
            make: m['Car Make'],
            model: m['Car Model'],
            year: { start: m['Car Start Year'], end: m['Car Stop Year'] },
            variation: m['Car Variation']
        })));
        
        // Then try to find exact matches with both make and model
        matches = makeMatches.filter(match => {
            const isMatch = modelsMatch(model, match['Car Model'], make);
            console.log(`Model match for ${match['Car Model']} vs ${model}: ${isMatch}`);
            return isMatch;
        });

        console.log('Model matches:', matches.map(m => ({
            make: m['Car Make'],
            model: m['Car Model'],
            year: { start: m['Car Start Year'], end: m['Car Stop Year'] },
            variation: m['Car Variation']
        })));

        // Filter matches by year range
        matches = matches?.filter(match => {
            const startYear = parseInt(match['Car Start Year']);
            const endYear = parseInt(match['Car Stop Year'] || '9999');
            return year >= startYear && year <= endYear;
        }) || [];

        console.log(`Found ${matches.length} initial matches`);

        let bestMatch = null;
        let inferredVariation = false;
        let matchConfidence: 'high' | 'medium' | 'low' = 'high';

        // Try exact variation if provided
        if (matches.length > 0) {
            if (carVariation && VALID_CAR_VARIATIONS.has(carVariation)) {
                const exactMatches = matches.filter(m => m['Car Variation'] === carVariation);
                bestMatch = findBestMatch(exactMatches);
            }
            
            // If no match, try common variations
            if (!bestMatch) {
                inferredVariation = true;
                matchConfidence = 'medium';
                
                for (const variation of COMMON_VARIATIONS) {
                    const commonMatches = matches.filter(m => m['Car Variation'] === variation);
                    bestMatch = findBestMatch(commonMatches);
                    if (bestMatch) break;
                }
                
                // If still no match, try all variations
                if (!bestMatch) {
                    matchConfidence = 'low';
                    bestMatch = findBestMatch(matches);
                }
            }
        }

        if (!bestMatch) {
            console.warn('No exact matches found for car');
            
            // Get suggestions if we have make matches
            if (makeMatches.length > 0) {
                const suggestions = getModelSuggestions(makeMatches, make, year);
                if (suggestions.length > 0) {
                    const bestMakeName = makeMatches[0]['Car Make']; // Use the name from DB for consistency
                    return json({
                        success: false,
                        productGroups: [],
                        message: 'No exact match found for the specified car',
                        query: { make, model, year, variation: carVariation },
                        suggestions: {
                            make: bestMakeName,
                            models: suggestions,
                            message: `We found "${bestMakeName}" but couldn't match "${model}". Did you mean one of these models?`
                        }
                    } as ThuleLookupErrorResponse);
                }
            }
            
            // If no suggestions, return the original error response
            return json({
                success: false,
                productGroups: [],
                message: 'No matches found for the specified car',
                query: { make, model, year, variation: carVariation }
            } as ThuleLookupErrorResponse);
        }

        // Create product groups from best match
        const productGroups = await createProductGroup(bestMatch, url);

        // Calculate model similarity for debugging
        const modelSimilarity = stringSimilarity(bestMatch['Car Model'], model);
        console.log('Model similarity score:', modelSimilarity);

        // Prepare response
        const response: ThuleLookupResponse = {
            success: true,
            car: {
                make: bestMatch['Car Make'],
                model: bestMatch['Car Model'],
                variation: bestMatch['Car Variation'],
                yearRange: {
                    start: parseInt(bestMatch['Car Start Year']),
                    end: parseInt(bestMatch['Car Stop Year'] || '9999')
                }
            },
            productGroups,
            k_type: bestMatch['K-TYPE'] ? [bestMatch['K-TYPE']] : [],
            matchConfidence: matchConfidence
        };

        // Add inference notes
        if (inferredVariation) {
            response.inferred = {
                message: `Rail type was automatically detected (${matchConfidence} confidence)`,
                detected: {
                    variation: bestMatch['Car Variation']
                },
                original: {
                    variation: carVariation || null
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
                yearRange: { start: 0, end: 0 }
            },
            productGroups: [],
            k_type: []
        }, { status: 500 });
    }
} 