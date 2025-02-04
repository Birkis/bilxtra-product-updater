import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabase } from '$lib/db/supabaseClient';
import { openai } from '$lib/openaiClient';
import { discoveryApi } from '$lib/crystallizeClient';

interface SearchQuery {
    make?: string;
    model?: string;
    productionYear?: number;
    numberOfDoors?: string;
    carVariation?: string;
    description?: string;
    carType?: string;
}

interface ModelMatch {
    model: string;
}

function normalizeModel(model: string): { normalized: string; base: string } {
    // Convert to uppercase for consistency
    const upperModel = model.toUpperCase();
    
    // Remove common suffixes and clean up
    const normalized = upperModel
        .replace(/[-\s]?(SERIES|KLASSE|CLASS|SERIE)$/i, '')
        .replace(/[-\s]?(TOURING|GRAN COUPE|GRAN COUPÉ|ACTIVE TOURER|GRAN TURISMO|COMPACT)$/i, '')
        .trim();
    
    // Get base model:
    // 1. For i-series (i4, i5, etc), use the full model
    // 2. For X-series (X1, X2, etc), use the full model
    // 3. For regular series (1-series, 2-series, etc), extract the number
    const base = normalized.match(/^I\d+|^IX\d*|^X\d+|^\d+/)?.[0] || normalized;
    
    return { 
        normalized,
        base
    };
}

interface SearchResult {
    car_details_vector_id: number;
    car_data_id: number;
    car_details: string;
    similarity: number;
    front_rack_id: number | null;
    front_rack_name: string | null;
    rear_rack_id: number | null;
    rear_rack_name: string | null;
    bar_id: number | null;
    bar_name: string | null;
    foot_id: number | null;
    foot_name: string | null;
    kit_id: number | null;
    kit_name: string | null;
    car_type: string | null;
    number_of_doors: string | null;
    car_variation: string | null;
    compatible_bar_for_caprock: boolean;
    compatible_rack_for_tent: boolean;
    compatible_roof_for_tent: boolean;
    foot_attachment: string | null;
    rack_product: string | null;
    product_score: number;
    combined_score: number;
    car_make: string;
    car_model: string;
    car_start_year: number;
    car_stop_year: number | null;
}

interface CarData {
    id: number;
    make: string;
    model: string;
    car_start_year: number;
    car_stop_year: number | null;
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

interface CarInfo {
    make: string;
    model: string;
    variation: string;
    yearRange: {
        start: number;
        end: number | null;
    };
}

interface EnhancedSearchResult extends SearchResult {
    productGroups: ProductGroup[];
    carInfo: CarInfo;
    matchConfidence: 'high' | 'medium' | 'low';
}

interface ProductSearchResponse {
    browse: {
        generiskProdukt: {
            hits: Array<{
                name: string;
                score: number;
                shortcuts: string[];
                itemId: string;
                defaultVariant: {
                    sku: string;
                    name: string;
                    firstImage: {
                        url: string;
                        key: string;
                    };
                    defaultPrice: number;
                    defaultStock: number;
                    stockLocations: Record<string, { stock: number }>;
                };
                paginationToken: string;
            }>;
            summary: {
                totalHits: number;
                hasMoreHits: boolean;
                hasPreviousHits: boolean;
            };
        };
    };
}

export async function POST({ request }: RequestEvent) {
    try {
        const searchParams: SearchQuery = await request.json();
        console.log('\n=== Search Request ===');
        console.log('Raw search params:', searchParams);

        // Step 1: Find potential model matches if we have a make and model
        let modelMatches: string[] = [];
        if (searchParams.make && searchParams.model) {
            console.log('\n=== Model Matching Step ===');
            const { normalized, base } = normalizeModel(searchParams.model);
            
            console.log('Normalized model:', normalized);
            console.log('Base model:', base);
            console.log('Original model:', searchParams.model);
            
            // First, let's see what models exist for this make
            const { data: allModels } = await supabase
                .from('car_data')
                .select('model')
                .eq('make', searchParams.make.toUpperCase())
                .limit(20);
            
            console.log('All models for make:', allModels);
            
            // Then try our specific match
            const { data: matches, error: matchError } = await supabase
                .from('car_data')
                .select('model')
                .eq('make', searchParams.make.toUpperCase())
                .or(`model.ilike.${base}-%,model.ilike.${normalized}%,model.eq.${searchParams.model}`)
                .limit(10);

            console.log('Raw matches:', matches);
            console.log('Match error:', matchError);

            if (matchError) {
                console.error('Error finding model matches:', matchError);
            } else if (matches && matches.length > 0) {
                // Remove duplicates and sort
                modelMatches = [...new Set(matches.map((m: ModelMatch) => m.model))].sort();
                console.log('Found model matches:', modelMatches);
            }
        }

        // If no model matches found, use the original model
        if (modelMatches.length === 0 && searchParams.model) {
            modelMatches = [searchParams.model];
        }

        // Format and execute search queries for each model match
        const searchQueries = modelMatches.map(model => {
            return [
                searchParams.make,
                model?.replace('etron', 'e-tron')?.replace(/\s+\d+$/, ''),  // Normalize e-tron format and remove model variants
                searchParams.numberOfDoors,
                searchParams.carVariation?.toLowerCase().startsWith('med') 
                    ? searchParams.carVariation 
                    : searchParams.carVariation ? `med ${searchParams.carVariation}` : undefined
            ]
            .filter(Boolean)
            .join(', ');
        });

        console.log('\n=== Search Queries ===');
        console.log('Generated queries:', searchQueries);

        // Generate embeddings for all queries
        const embeddings = await Promise.all(searchQueries.map(async query => {
            console.log('Generating embedding for query:', query);
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: query,
                encoding_format: "float"
            });
            return embeddingResponse.data[0].embedding;
        }));

        // Execute vector searches for all embeddings
        const searchResults = await Promise.all(embeddings.map(async (embedding, index) => {
            const { data: matches, error } = await supabase
                .rpc('match_car_details', {
                    query_embedding: embedding,
                    match_threshold: 0.05,
                    match_count: 50,
                    car_production_year: searchParams.productionYear || null
                });

            if (error) {
                console.error(`Error in vector search for query ${index}:`, error);
                return [];
            }

            return matches || [];
        }));

        // Merge and deduplicate results
        const allResults = searchResults.flat();
        const uniqueResults = Array.from(new Map(allResults.map(item => [item.car_details_vector_id, item])).values());
        
        // Sort by similarity
        uniqueResults.sort((a, b) => b.similarity - a.similarity);

        console.log('\n=== Combined Results ===');
        console.log('Total unique matches:', uniqueResults.length);
        if (uniqueResults.length > 0) {
            console.log('Top 3 matches:', uniqueResults.slice(0, 3).map(m => ({
                description: m.car_details,
                similarity: m.similarity,
                product_score: m.product_score,
                combined_score: m.combined_score
            })));
        }

        // Process matches and enhance with product groups
        const enhancedResults = await Promise.all(uniqueResults.map(async (match: SearchResult) => {
            const productGroups = await createProductGroups(match);
            const carInfo: CarInfo = {
                make: match.car_make,
                model: match.car_model,
                variation: match.car_variation || '',
                yearRange: {
                    start: match.car_start_year,
                    end: match.car_stop_year
                }
            };

            // Determine match confidence based on similarity score
            let matchConfidence: 'high' | 'medium' | 'low';
            if (match.similarity > 0.75) {
                matchConfidence = 'high';
            } else if (match.similarity > 0.5) {
                matchConfidence = 'medium';
            } else {
                matchConfidence = 'low';
            }

            // If we have product matches, boost the confidence
            if (match.product_score > 0.5) {
                if (matchConfidence === 'low' && match.similarity > 0.3) {
                    matchConfidence = 'medium';
                } else if (matchConfidence === 'medium') {
                    matchConfidence = 'high';
                }
            }

            return {
                ...match,
                productGroups,
                carInfo,
                matchConfidence
            };
        }));

        return json({
            success: true,
            results: enhancedResults,
            totalMatches: enhancedResults.length,
            searchMetadata: {
                queries: searchQueries,
                embeddingLength: embeddings[0]?.length || 0,
                matchThreshold: 0.05,
                modelMatches: modelMatches
            }
        });

    } catch (err) {
        console.error('Vector search error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return json({
            success: false,
            error: errorMessage,
            details: err instanceof Error ? err.stack : undefined
        }, { status: 500 });
    }
}

async function fetchProductDetails(productIds: string[]): Promise<Map<string, { url: string; name: string }>> {
    const productMap = new Map<string, { url: string; name: string }>();
    
    if (productIds.length === 0) return productMap;

    // Create a regex pattern that matches any of the SKUs
    const skuPattern = productIds.map(id => {
        // Special case for bar SKUs (711x00 and 711x20)
        if (id.match(/^711\d(00|20)$/)) {
            const shortened = id.slice(0, 4);  // Get 711x part
            return `(THU-${id}|THU-${shortened})`;
        }
        // Special case for foot SKUs (710x00 and 720x00)
        if (id.match(/^7[12]0\d00$/)) {
            const shortened = id.slice(0, 4);  // Get 710x/720x part
            return `(THU-${id}|THU-${shortened})`;
        }
        return `THU-${id}`;
    }).join('|');
    
    console.log('\n=== Product Lookup ===');
    console.log('Product IDs:', productIds);
    console.log('SKU Pattern:', skuPattern);
    
    const query = `
        query FIND_PRODUCTS($sku_pattern: String!) {
            browse {
                generiskProdukt(
                    pagination: { limit: 100 }
                    filters: {
                        OR: [
                            { sku: { regex: $sku_pattern }}
                        ]
                    }
                    sorting: { score: desc }
                ) {
                    hits {
                        name
                        shortcuts
                        defaultVariant {
                            sku
                            name
                        }
                    }
                }
            }
        }
    `;

    try {
        const data = await discoveryApi<ProductSearchResponse>(query, {
            sku_pattern: skuPattern
        });

        console.log('\n=== Discovery API Response ===');
        console.log('Query:', query);
        console.log('SKU Pattern:', skuPattern);
        console.log('Response:', JSON.stringify(data, null, 2));

        // Process each hit and store in the map
        data.browse.generiskProdukt.hits.forEach(hit => {
            const sku = hit.defaultVariant.sku;
            const id = sku.replace('THU-', '');
            const validShortcut = hit.shortcuts?.find(s => s.startsWith('/categories')) || '/ukategorisert';
            const cleanPath = validShortcut.replace(/^\/categories/, '');
            
            console.log('\n=== Processing Hit ===');
            console.log('SKU:', sku);
            console.log('ID:', id);
            console.log('Shortcuts:', hit.shortcuts);
            console.log('Valid Shortcut:', validShortcut);
            console.log('Clean Path:', cleanPath);
            
            // Store both the full and shortened versions in the map
            const fullId = id;
            const shortId = id.length === 6 && (id.startsWith('711') || id.startsWith('710') || id.startsWith('720')) 
                ? id.slice(0, 4) 
                : id;
            
            const productInfo = {
                url: `https://bilxtra.no${cleanPath}`,
                name: hit.defaultVariant.name
            };
            
            productMap.set(fullId, productInfo);
            productMap.set(shortId, productInfo);
        });

    } catch (error) {
        console.error('\n=== Discovery API Error ===');
        console.error('Error:', error);
        console.error('Query:', query);
        console.error('SKU Pattern:', skuPattern);
    }

    console.log('\n=== Final Product Map ===');
    console.log(Object.fromEntries(productMap));
    return productMap;
}

async function createProductGroups(match: {
    front_rack_id: number | null;
    front_rack_name: string | null;
    rear_rack_id: number | null;
    rear_rack_name: string | null;
    bar_id: number | null;
    bar_name: string | null;
    foot_id: number | null;
    foot_name: string | null;
    kit_id: number | null;
    kit_name: string | null;
}): Promise<ProductGroup[]> {
    const groups: ProductGroup[] = [];
    const products: Product[] = [];

    // Convert nulls to undefined for optional fields
    const safeMatch = {
        front_rack_id: match.front_rack_id || undefined,
        front_rack_name: match.front_rack_name || undefined,
        rear_rack_id: match.rear_rack_id || undefined,
        rear_rack_name: match.rear_rack_name || undefined,
        bar_id: match.bar_id || undefined,
        bar_name: match.bar_name || undefined,
        foot_id: match.foot_id || undefined,
        foot_name: match.foot_name || undefined,
        kit_id: match.kit_id || undefined,
        kit_name: match.kit_name || undefined
    };

    // Collect all product IDs
    const productIds: string[] = [];
    if (safeMatch.front_rack_id) productIds.push(safeMatch.front_rack_id.toString());
    if (safeMatch.rear_rack_id) productIds.push(safeMatch.rear_rack_id.toString());
    if (safeMatch.bar_id) productIds.push(safeMatch.bar_id.toString());
    if (safeMatch.foot_id) productIds.push(safeMatch.foot_id.toString());
    if (safeMatch.kit_id) productIds.push(safeMatch.kit_id.toString());

    // Fetch product details from Crystallize
    const productDetails = await fetchProductDetails(productIds);

    // Handle complete racks if present
    const completeRackProducts: Product[] = [];
    if (safeMatch.front_rack_id) {
        const frontRackId = safeMatch.front_rack_id.toString();
        const details = productDetails.get(frontRackId);
        completeRackProducts.push({
            sku: `THU-${frontRackId}`,
            type: 'complete_rack',
            url: details?.url || null,
            name: details?.name || safeMatch.front_rack_name || `Front rack ${safeMatch.front_rack_id}`,
            position: 'front'
        });
    }
    if (safeMatch.rear_rack_id) {
        const rearRackId = safeMatch.rear_rack_id.toString();
        const details = productDetails.get(rearRackId);
        completeRackProducts.push({
            sku: `THU-${rearRackId}`,
            type: 'complete_rack',
            url: details?.url || null,
            name: details?.name || safeMatch.rear_rack_name || `Rear rack ${safeMatch.rear_rack_id}`,
            position: 'rear'
        });
    }

    if (completeRackProducts.length > 0) {
        groups.push({
            type: 'complete_rack',
            isPreferred: true,
            products: completeRackProducts
        });
    }

    // Handle individual components
    const componentProducts: Product[] = [];
    if (safeMatch.bar_id) {
        const barId = safeMatch.bar_id.toString();
        const details = productDetails.get(barId) || productDetails.get(barId.slice(0, 4));
        if (details) {  // Only add if we found the product
            componentProducts.push({
                sku: `THU-${barId}`,
                type: 'bar',
                url: details.url,
                name: details.name || safeMatch.bar_name || `Bar ${safeMatch.bar_id}`
            });
        }
    }
    if (safeMatch.foot_id) {
        const footId = safeMatch.foot_id.toString();
        const details = productDetails.get(footId) || productDetails.get(footId.slice(0, 4));
        if (details) {  // Only add if we found the product
            componentProducts.push({
                sku: `THU-${footId}`,
                type: 'foot',
                url: details.url,
                name: details.name || safeMatch.foot_name || `Foot ${safeMatch.foot_id}`
            });
        }
    }
    if (safeMatch.kit_id) {
        const kitId = safeMatch.kit_id.toString();
        const details = productDetails.get(kitId) || productDetails.get(kitId.slice(0, 4));
        if (details) {  // Only add if we found the product
            componentProducts.push({
                sku: `THU-${kitId}`,
                type: 'kit',
                url: details.url,
                name: details.name || safeMatch.kit_name || `Kit ${safeMatch.kit_id}`
            });
        }
    }

    if (componentProducts.length > 0) {
        groups.push({
            type: 'individual_components',
            isPreferred: false,
            products: componentProducts
        });
    }

    return groups;
} 