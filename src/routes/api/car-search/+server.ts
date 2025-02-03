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

        // Format the search query to match the database format
        const searchQuery = searchParams.description || 
            [
                searchParams.make,
                searchParams.model?.replace('etron', 'e-tron'),  // Normalize e-tron format
                searchParams.carType,
                searchParams.numberOfDoors?.replace('4-dr', '5-dr'),  // Try with 5-dr since that's what we have
                searchParams.carVariation ? `med ${searchParams.carVariation}` : undefined,  // Add 'med' prefix if missing
                searchParams.productionYear ? `${searchParams.productionYear}` : undefined,
                searchParams.productionYear ? 'onwards' : undefined
            ]
            .filter(Boolean)
            .join(', ');

        console.log('\n=== Query Formation ===');
        console.log('Formatted search Query:', searchQuery);
        console.log('Query components:', {
            make: searchParams.make,
            model: searchParams.model,
            year: searchParams.productionYear,
            doors: searchParams.numberOfDoors,
            variation: searchParams.carVariation
        });

        // Generate embedding for search query
        console.log('\n=== Embedding Generation ===');
        console.log('Generating embedding for query:', searchQuery);
        
        let embeddingResponse;
        try {
            embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: searchQuery,
                encoding_format: "float"
            });
        } catch (embeddingError) {
            console.error('OpenAI embedding error:', embeddingError);
            return json({
                success: false,
                error: 'Failed to generate search embedding',
                details: embeddingError instanceof Error ? embeddingError.message : 'Unknown error'
            }, { status: 500 });
        }

        if (!embeddingResponse?.data?.[0]?.embedding) {
            console.error('Invalid embedding response:', embeddingResponse);
            return json({
                success: false,
                error: 'Invalid embedding response from OpenAI',
                details: 'Embedding data is missing or malformed'
            }, { status: 500 });
        }

        console.log('Embedding vector length:', embeddingResponse.data[0].embedding.length);
        console.log('First 5 embedding values:', embeddingResponse.data[0].embedding.slice(0, 5));

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Check if we have any data in the tables
        console.log('\n=== Database Check ===');
        const { count: carDataCount, error: countError } = await supabase
            .from('car_data')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('Error checking car_data table:', countError);
            throw new Error(`Database error: ${countError.message}`);
        }

        console.log('Number of records in car_data:', carDataCount);

        if (carDataCount === 0) {
            return json({
                success: true,
                results: [],
                message: 'No records found in database'
            });
        }

        // Search using both original and HNSW functions
        console.log('\n=== Vector Search Comparison ===');
        console.log('Executing both vector search functions with params:', {
            make: searchParams.make || 'null',
            model: searchParams.model || 'null',
            production_year: searchParams.productionYear || 'null',
            match_threshold: 0.05,  // Very low threshold to get more matches
            match_count: 50
        });

        const startOriginal = performance.now();
        const { data: originalMatches, error: originalError } = await supabase
            .rpc('match_car_details', {
                query_embedding: queryEmbedding,
                match_threshold: 0.05,  // Very low threshold to get more matches
                match_count: 50,
                car_production_year: searchParams.productionYear || null
            });
        const endOriginal = performance.now();

        const startHnsw = performance.now();
        const { data: hnswMatches, error: hnswError } = await supabase
            .rpc('match_car_details_hnsw', {
                query_embedding: queryEmbedding,
                car_make: searchParams.make || null,
                car_model: searchParams.model?.replace('etron', 'e-tron') || null,  // Normalize e-tron format
                car_production_year: searchParams.productionYear || null,
                match_threshold: 0.05,  // Very low threshold to get more matches
                match_count: 50
            });
        const endHnsw = performance.now();

        // Log performance comparison
        console.log('\n=== Search Performance ===');
        console.log('Original function time:', endOriginal - startOriginal, 'ms');
        console.log('HNSW function time:', endHnsw - startHnsw, 'ms');
        console.log('Speed improvement:', ((endOriginal - startOriginal) / (endHnsw - startHnsw)).toFixed(2) + 'x');

        // Compare results
        console.log('\n=== Results Comparison ===');
        console.log('Original matches:', originalMatches?.length || 0);
        console.log('HNSW matches:', hnswMatches?.length || 0);

        if (originalError || hnswError) {
            console.error('Vector search errors:', {
                original: originalError,
                hnsw: hnswError
            });
            throw new Error(`Search error: ${originalError?.message || hnswError?.message}`);
        }

        // Use HNSW results if available, fall back to original
        const matches = hnswMatches || originalMatches;

        console.log('\n=== Search Results ===');
        console.log('Total matches found:', matches?.length || 0);
        if (matches?.length > 0) {
            console.log('Top 3 matches:', matches.slice(0, 3).map((m: SearchResult) => ({
                description: m.car_details,
                similarity: m.similarity,
                product_score: m.product_score,
                combined_score: m.combined_score
            })));
        }

        // Process matches and enhance with product groups
        console.log('\n=== Result Processing ===');
        const enhancedResults = await Promise.all(matches.map(async (match: SearchResult) => {
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
                query: searchQuery,
                embeddingLength: queryEmbedding.length,
                matchThreshold: 0.05,
                performance: {
                    originalSearchTime: endOriginal - startOriginal,
                    hnswSearchTime: endHnsw - startHnsw,
                    speedImprovement: ((endOriginal - startOriginal) / (endHnsw - startHnsw)).toFixed(2)
                }
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
        // Special case for 711x00 SKUs - try both full and shortened versions
        if (id.match(/^711\d00$/)) {
            const shortened = id.slice(0, 4);  // Get 711x part
            return `(THU-${id}|THU-${shortened})`;
        }
        return `THU-${id}`;
    }).join('|');
    
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

        // Process each hit and store in the map
        data.browse.generiskProdukt.hits.forEach(hit => {
            const sku = hit.defaultVariant.sku;
            const id = sku.replace('THU-', '');
            const validShortcut = hit.shortcuts?.find(s => s.startsWith('/categories')) || '/ukategorisert';
            const cleanPath = validShortcut.replace(/^\/categories/, '');
            
            productMap.set(id, {
                url: `https://bilxtra.no${cleanPath}`,
                name: hit.defaultVariant.name
            });
        });

    } catch (error) {
        console.error('Error fetching product details:', error);
    }

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
        const details = productDetails.get(barId);
        componentProducts.push({
            sku: `THU-${barId}`,
            type: 'bar',
            url: details?.url || null,
            name: details?.name || safeMatch.bar_name || `Bar ${safeMatch.bar_id}`
        });
    }
    if (safeMatch.foot_id) {
        const footId = safeMatch.foot_id.toString();
        const details = productDetails.get(footId);
        componentProducts.push({
            sku: `THU-${footId}`,
            type: 'foot',
            url: details?.url || null,
            name: details?.name || safeMatch.foot_name || `Foot ${safeMatch.foot_id}`
        });
    }
    if (safeMatch.kit_id) {
        const kitId = safeMatch.kit_id.toString();
        const details = productDetails.get(kitId);
        componentProducts.push({
            sku: `THU-${kitId}`,
            type: 'kit',
            url: details?.url || null,
            name: details?.name || safeMatch.kit_name || `Kit ${safeMatch.kit_id}`
        });
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