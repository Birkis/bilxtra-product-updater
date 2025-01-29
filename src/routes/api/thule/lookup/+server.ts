import { error, json } from '@sveltejs/kit';
import { supabase } from '../../../../lib/db/supabaseClient';

// --- Oppdater denne listen ved behov ---
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

// Noen vanlige varianter vi prøver hvis brukeren ikke har spesifisert
const COMMON_VARIATIONS = [
    'med normalt tak',
    'med integrerte relinger',
    'med takrenner'
];

// Disse interfacene er bare for å tydeliggjøre responsen
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
    position?: 'front' | 'rear';
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

// Hjelpefunksjon for produkt‐URL (hvis du har SKU -> link)
async function getProductUrl(sku: string, requestUrl: URL): Promise<string | null> {
    // Her kan du slå opp en produkt‐URL basert på SKU i en annen tabell, f.eks.
    // Returner null dersom du ikke har en link
    return null;
}

// Eksempel på hvordan du lager productGroups (du kan utvide denne)
async function createProductGroup(match: any, requestUrl: URL): Promise<ProductGroup[]> {
    const productGroups: ProductGroup[] = [];

    // Her ville du pakke ut data fra match (Front Rack ID, Rear Rack ID, Bar ID, Foot ID, Kit ID, osv.)
    // og bygge et array av Product‐objekter.
    // Under er bare et eksempel:

    const frontRackSku = match['Complete Front Rack ID'];
    const rearRackSku = match['Complete Rear Rack ID'];
    const barSku = match['Bar ID'];
    const footSku = match['Foot ID'];
    const kitSku = match['RackSolution Kit ID'];

    const frontRackProduct: Product | null = frontRackSku
        ? {
            sku: frontRackSku,
            type: 'complete_rack',
            url: await getProductUrl(frontRackSku, requestUrl),
            name: `Front rack ${frontRackSku}`,
            position: 'front'
        }
        : null;

    const rearRackProduct: Product | null = rearRackSku
        ? {
            sku: rearRackSku,
            type: 'complete_rack',
            url: await getProductUrl(rearRackSku, requestUrl),
            name: `Rear rack ${rearRackSku}`,
            position: 'rear'
        }
        : null;

    const barProduct: Product | null = barSku
        ? {
            sku: barSku,
            type: 'bar',
            url: await getProductUrl(barSku, requestUrl),
            name: `Bar ${barSku}`
        }
        : null;
    const footProduct: Product | null = footSku
        ? {
            sku: footSku,
            type: 'foot',
            url: await getProductUrl(footSku, requestUrl),
            name: `Foot ${footSku}`
        }
        : null;
    const kitProduct: Product | null = kitSku
        ? {
            sku: kitSku,
            type: 'kit',
            url: await getProductUrl(kitSku, requestUrl),
            name: `Kit ${kitSku}`
        }
        : null;

    // Bygg "Complete Rack" group om både front og/eller rear racks finnes
    if (frontRackProduct || rearRackProduct) {
        productGroups.push({
            type: 'complete_rack',
            isPreferred: true,
            products: [frontRackProduct, rearRackProduct].filter(Boolean) as Product[]
        });
    }

    // Bygg "Individual Components" group
    const individualComponents = [barProduct, footProduct, kitProduct].filter(Boolean) as Product[];
    if (individualComponents.length > 0) {
        productGroups.push({
            type: 'individual_components',
            isPreferred: false,
            products: individualComponents
        });
    }

    return productGroups;
}

// En enkel Levenshtein for strenglikhet
function levenshteinDistance(s1: string, s2: string): number {
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;
    const matrix: number[][] = Array.from({ length: s2.length + 1 }, () =>
        Array(s1.length + 1).fill(0)
    );

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
                    matrix[i - 1][j - 1] + 1, // substitusjon
                    matrix[i][j - 1] + 1,     // innsetting
                    matrix[i - 1][j] + 1      // sletting
                );
            }
        }
    }
    return matrix[s2.length][s1.length];
}

// Fuzzy scoringsfunksjon for strenglikhet (0–1)
function stringSimilarity(str1: string, str2: string): number {
    function normalize(str: string): string {
        return str
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\d\s\-_]/g, '')
            .replace(/[-–—]/g, '-');
    }

    const s1 = normalize(str1);
    const s2 = normalize(str2);

    if (s1 === s2) return 1;
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
}

// "Normalisering" av modellnavn, inkl. spesiell håndtering av e-tron, BMW etc.
function normalizeModelName(model: string, make?: string): string {
    const lower = model.toLowerCase().trim();

    // Audi e-tron: la oss bare bevare "e-tron" mest mulig.  
    // Men hvis man har "Q4 e-tron" eller "Q4 etron" => la oss bare normalisere spacing og bindestreker.
    if (make?.toLowerCase() === 'audi' && lower.includes('tron')) {
        // Fjern unødvendige tegn, men bevar "e-tron" og eventuelle "Q" + tall 
        return lower
            .replace(/etron/g, 'e-tron')
            .replace(/ +/g, ' ')
            .trim();
    }

    // BMW "3-series", "5-series" etc.
    if (make?.toUpperCase() === 'BMW') {
        // Lignende logikk for "3 series" => "3-series", "320d" => "3-series"
        const pattern = /^(\d{1,2})\s*(series|er)?/;
        const match = lower.match(pattern);
        if (match) {
            return `${match[1]}-series`;
        }
        // Evt. "320d" => "3-series":
        if (/^\d{3}[a-z]?$/i.test(lower)) {
            return lower.charAt(0) + '-series';
        }
    }

    // Hvis ingenting spesielt: bare litt generisk normalisering
    return lower
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Tester om et inputModel "matcher" dbModel for gitt make.
 * Med litt ekstra logikk for e-tron varianter (Q4 e-tron, etc).
 */
function modelsMatch(inputModel: string, dbModel: string, make?: string): boolean {
    const inputNormalized = normalizeModelName(inputModel, make);
    const dbNormalized = normalizeModelName(dbModel, make);

    if (inputNormalized === dbNormalized) {
        return true;
    }

    // Special handling for Audi e-tron
    if (make?.toLowerCase() === 'audi' && (inputNormalized.includes('e-tron') || dbNormalized.includes('e-tron'))) {
        // Split into parts for comparison
        const inputParts = inputNormalized.split(/\s+/).filter(Boolean);
        const dbParts = dbNormalized.split(/\s+/).filter(Boolean);

        // If user entered just "e-tron"
        if (inputParts.length === 1 && inputParts[0] === 'e-tron') {
            // Match base e-tron models and allow variants
            return dbParts.includes('e-tron');
        }

        // For specific e-tron variants (e.g., "e-tron gt", "q4 e-tron")
        // require all input parts to be present in the database model
        return inputParts.every(part => dbParts.includes(part));
    }

    // Ellers fallback til fuzzy scoringsfunksjon
    const sim = stringSimilarity(inputNormalized, dbNormalized);
    return sim >= 0.7;
}

// Gir en "score" til en match, brukes for å finne best match hvis flere
function scoreMatch(match: any) {
    let score = 0;
    let componentCount = 0;

    // Product completeness scoring
    const hasFrontRack = !!match['Complete Front Rack ID'];
    const hasRearRack = !!match['Complete Rear Rack ID'];
    if (hasFrontRack && hasRearRack) {
        score += 8;
    } else if (hasFrontRack || hasRearRack) {
        score += 3;
    }

    const hasBar = !!match['Bar ID'];
    const hasFoot = !!match['Foot ID'];
    const hasKit = !!match['RackSolution Kit ID'];
    if (hasBar) componentCount++;
    if (hasFoot) componentCount++;
    if (hasKit) componentCount++;
    score += componentCount;

    // Model matching scoring
    const userModel = normalizeModelName(match.userInputModel || '', match['Car Make']);
    const dbModel = normalizeModelName(match['Car Model'], match['Car Make']);
    
    // Exact match bonus
    if (userModel === dbModel) {
        score += 10;
    }
    
    // E-tron specific scoring
    if (match['Car Make']?.toLowerCase() === 'audi') {
        const userParts = userModel.split(/\s+/);
        const dbParts = dbModel.split(/\s+/);
        
        // Base e-tron matching
        if (userParts.length === 1 && userParts[0] === 'e-tron') {
            // Highest score for exact "e-tron" match
            if (dbParts.length === 1 && dbParts[0] === 'e-tron') {
                score += 20;
            }
            // Lower but still good score for e-tron variants
            else if (dbParts.includes('e-tron')) {
                score += 10;
            }
        }
        // Specific e-tron variant matching
        else if (userParts.includes('e-tron')) {
            const matchCount = userParts.filter(p => dbParts.includes(p)).length;
            score += matchCount * 5;
        }
    }

    return {
        score,
        hasCompleteSolution: hasFrontRack || hasRearRack,
        hasFullComponentSet: componentCount === 3,
        hasBothRacks: hasFrontRack && hasRearRack,
        match
    };
}

function findBestMatch(matches: any[], userInput: { model: string }): any | null {
    if (!matches?.length) return null;

    const scored = matches.map(m => {
        const matchWithInput = { ...m, userInputModel: userInput.model };
        return scoreMatch(matchWithInput);
    });

    scored.sort((a, b) => {
        // 1) Highest score first
        if (b.score !== a.score) return b.score - a.score;
        // 2) If equal score, prefer complete solutions
        if (a.hasCompleteSolution !== b.hasCompleteSolution) {
            return a.hasCompleteSolution ? -1 : 1;
        }
        // 3) If still equal, prefer full component sets
        if (a.hasFullComponentSet !== b.hasFullComponentSet) {
            return a.hasFullComponentSet ? -1 : 1;
        }
        return 0;
    });

    return scored[0].match;
}

/**
 * Henter ut ulike mulige modeller (forslag) hvis du ikke finner en presis match.
 * Nyttig for feilmeldinger "Visste du at du mente ... ?".
 */
function getModelSuggestions(matches: any[], make: string, targetYear: number): ModelSuggestion[] {
    const modelMap = new Map<string, ModelSuggestion>();
    matches.forEach(m => {
        // Sjekk at merketsimilaritet er høy nok
        const mkSim = stringSimilarity(m['Car Make'], make);
        if (mkSim >= 0.7) {
            const model = m['Car Model'];
            const startYear = parseInt(m['Car Start Year']);
            const endYear = parseInt(m['Car Stop Year'] || '9999');

            // Inkluder bare modeller i rimelig nærhet av targetYear
            const yearBuffer = 2;
            if (targetYear >= startYear - yearBuffer && targetYear <= endYear + yearBuffer) {
                if (!modelMap.has(model)) {
                    modelMap.set(model, {
                        model,
                        yearRange: { start: startYear, end: endYear },
                        variations: [m['Car Variation']]
                    });
                } else {
                    const existing = modelMap.get(model)!;
                    if (!existing.variations.includes(m['Car Variation'])) {
                        existing.variations.push(m['Car Variation']);
                    }
                    existing.yearRange.start = Math.min(existing.yearRange.start, startYear);
                    existing.yearRange.end = Math.max(existing.yearRange.end, endYear);
                }
            }
        }
    });

    return Array.from(modelMap.values());
}

// Selve GET-metoden
export async function GET({ url }) {
    try {
        const make = url.searchParams.get('make')?.trim() || '';
        const model = url.searchParams.get('model')?.trim() || '';
        const year = parseInt(url.searchParams.get('year') || '');
        const carVariation = url.searchParams.get('variation')?.trim() || '';

        // Sjekk påkrevde parametere (make, model, year)
        if (!make || !model || !year) {
            return json({
                success: false,
                productGroups: [],
                message: 'Missing required parameters',
                query: { make, model, year, variation: carVariation }
            });
        }

        // Forsøk først en snever SELECT hvis mulig
        let { data: matches, error: dbError } = await supabase
            .from('car_fits')
            .select('*');

        if (dbError) {
            console.error('Database error:', dbError);
            throw error(500, 'Failed to process request');
        }

        // 1) Filtrer på make (fuzzy)
        const makeMatches = (matches || []).filter(m => {
            const sim = stringSimilarity(m['Car Make'], make);
            return sim >= 0.7;
        });
        if (!makeMatches.length) {
            // Hvis ingen merker i det hele tatt
            return json({
                success: false,
                productGroups: [],
                message: 'No matches found for the specified make',
                query: { make, model, year, variation: carVariation }
            } as ThuleLookupErrorResponse);
        }

        // 2) Filtrer på modell
        let modelMatches = makeMatches.filter(m => modelsMatch(model, m['Car Model'], make));
        if (!modelMatches.length) {
            // Hvis ingen modellsvar, la oss foreslå mulige modeller
            const suggestions = getModelSuggestions(makeMatches, make, year);
            if (suggestions.length > 0) {
                return json({
                    success: false,
                    productGroups: [],
                    message: 'No exact match found for the specified model',
                    query: { make, model, year, variation: carVariation },
                    suggestions: {
                        make: makeMatches[0]['Car Make'],
                        models: suggestions,
                        message: `We found "${makeMatches[0]['Car Make']}" but couldn't match "${model}". Did you mean one of these models?`
                    }
                } as ThuleLookupErrorResponse);
            }

            return json({
                success: false,
                productGroups: [],
                message: 'No matches found for that model',
                query: { make, model, year, variation: carVariation }
            } as ThuleLookupErrorResponse);
        }

        // 3) Filtrer på år
        modelMatches = modelMatches.filter(m => {
            const start = parseInt(m['Car Start Year']);
            const stop = parseInt(m['Car Stop Year'] || '9999');
            return year >= start && year <= stop;
        });

        if (!modelMatches.length) {
            // Ingen matchende år
            return json({
                success: false,
                productGroups: [],
                message: 'No matches found for that year range',
                query: { make, model, year, variation: carVariation }
            } as ThuleLookupErrorResponse);
        }

        // 4) Finn best match for gitt variant, eventuelt gjett
        let bestMatch: any = null;
        let matchConfidence: 'high' | 'medium' | 'low' = 'high';
        let inferredVariation = false;

        if (carVariation && VALID_CAR_VARIATIONS.has(carVariation)) {
            // Prøv eksakt variant
            const exactVarMatches = modelMatches.filter(m => m['Car Variation'] === carVariation);
            bestMatch = findBestMatch(exactVarMatches, { model });
        }

        if (!bestMatch) {
            // Hvis ingen treff på eksakt variant, forsøk en liste med common variations
            inferredVariation = true;
            matchConfidence = 'medium';

            for (const v of COMMON_VARIATIONS) {
                const varMatches = modelMatches.filter(m => m['Car Variation'] === v);
                bestMatch = findBestMatch(varMatches, { model });
                if (bestMatch) break;
            }

            // Hvis fremdeles null, ta den "beste" i alt
            if (!bestMatch) {
                matchConfidence = 'low';
                bestMatch = findBestMatch(modelMatches, { model });
            }
        }

        if (!bestMatch) {
            // Som en siste fallback – returner feilmelding + eventuelt forslag
            const suggestions = getModelSuggestions(makeMatches, make, year);
            if (suggestions.length > 0) {
                return json({
                    success: false,
                    productGroups: [],
                    message: 'No exact match found',
                    query: { make, model, year, variation: carVariation },
                    suggestions: {
                        make: makeMatches[0]['Car Make'],
                        models: suggestions,
                        message: `We found "${makeMatches[0]['Car Make']}" but no perfect match.`
                    }
                } as ThuleLookupErrorResponse);
            }

            return json({
                success: false,
                productGroups: [],
                message: 'No matches found',
                query: { make, model, year, variation: carVariation }
            } as ThuleLookupErrorResponse);
        }

        // Determine match confidence based on model matching
        const userModel = normalizeModelName(model, make);
        const dbModel = normalizeModelName(bestMatch['Car Model'], make);
        
        // Start with medium confidence
        matchConfidence = 'medium';
        
        // Exact matches should be high confidence
        if (userModel === dbModel) {
            matchConfidence = 'high';
        }
        // Special handling for e-tron
        else if (make?.toLowerCase() === 'audi' && userModel.includes('e-tron')) {
            const userParts = userModel.split(/\s+/);
            const dbParts = dbModel.split(/\s+/);
            
            // If user searched for just "e-tron" and we found an e-tron variant
            if (userParts.length === 1 && userParts[0] === 'e-tron' && dbParts.includes('e-tron')) {
                matchConfidence = 'high';
            }
            // If all parts of the user's search are in the DB model
            else if (userParts.every(part => dbParts.includes(part))) {
                matchConfidence = 'high';
            }
        }
        
        // If we had to infer the variation, cap confidence at medium
        if (inferredVariation && matchConfidence === 'high') {
            matchConfidence = 'medium';
        }

        // Lag productGroups
        const productGroups = await createProductGroup(bestMatch, url);
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
            matchConfidence
        };

        // Om vi "gjettet" variant
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
        console.error('Error:', err);
        return json({
            success: false,
            productGroups: [],
            error: 'Internal server error',
            query: {
                make: url.searchParams.get('make'),
                model: url.searchParams.get('model'),
                year: parseInt(url.searchParams.get('year') || ''),
                variation: url.searchParams.get('variation')
            }
        }, { status: 500 });
    }
}