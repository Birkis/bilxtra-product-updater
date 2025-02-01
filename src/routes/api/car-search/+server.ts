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
                searchParams.model,
                searchParams.carType,
                searchParams.numberOfDoors,
                searchParams.productionYear ? `${searchParams.productionYear}` : undefined,
                searchParams.carVariation
            ]
            .filter(Boolean)
            .join(', ');

        console.log('\n=== Query Formation ===');
        console.log('Formatted search query:', searchQuery);
        console.log('Query components:', {
            make: searchParams.make,
            model: searchParams.model,
            year: searchParams.productionYear,
            doors: searchParams.numberOfDoors,
            variation: searchParams.carVariation
        });

        try {
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

            // Search using Supabase function
            console.log('\n=== Vector Search ===');
            console.log('Executing vector search with params:', {
                match_threshold: 0.0,
                match_count: 50,
                car_production_year: searchParams.productionYear || 'null'
            });

            const { data: matches, error: searchError } = await supabase
                .rpc('match_car_details', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.0,
                    match_count: 50,
                    car_production_year: searchParams.productionYear || null
                });

            if (searchError) {
                console.error('Vector search error:', searchError);
                throw new Error(`Search error: ${searchError.message}`);
            }

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

            // Get the car details for the matches
            const carDataIds = matches?.map((m: SearchResult) => m.car_data_id) || [];
            
            if (carDataIds.length === 0) {
                return json({
                    success: true,
                    results: [],
                    message: 'No matches found'
                });
            }

            console.log('\n=== Car Details Fetch ===');
            console.log('Fetching details for car_data_ids:', carDataIds.slice(0, 5), '...');
            const { data: carDetails, error: carError } = await supabase
                .from('car_data')
                .select('*')
                .in('id', carDataIds);

            if (carError) {
                console.error('Error fetching car details:', carError);
                throw new Error(`Database error: ${carError.message}`);
            }

            // Combine the results
            console.log('\n=== Result Processing ===');
            const processedMatches = matches?.map((match: SearchResult) => {
                const carData = carDetails?.find((c: CarData) => c.id === match.car_data_id);
                if (!carData) return null;

                const makeMatch = searchParams.make ? 
                    carData.make.toLowerCase() === searchParams.make.toLowerCase() : true;
                const modelMatch = searchParams.model ? 
                    carData.model.toLowerCase().includes(searchParams.model.toLowerCase()) : true;

                console.log('Processing match:', {
                    car: `${carData.make} ${carData.model}`,
                    description: match.car_details,
                    similarity: match.similarity,
                    product_score: match.product_score,
                    combined_score: match.combined_score,
                    makeMatch,
                    modelMatch
                });

                if (!makeMatch || !modelMatch) return null;

                return {
                    id: match.car_details_vector_id,
                    similarity: match.similarity,
                    car_make: carData.make,
                    car_model: carData.model,
                    car_start_year: carData.car_start_year,
                    car_stop_year: carData.car_stop_year,
                    car_description: match.car_details,
                    front_rack_id: match.front_rack_id,
                    front_rack_name: match.front_rack_name,
                    rear_rack_id: match.rear_rack_id,
                    rear_rack_name: match.rear_rack_name,
                    bar_id: match.bar_id,
                    bar_name: match.bar_name,
                    foot_id: match.foot_id,
                    foot_name: match.foot_name,
                    kit_id: match.kit_id,
                    kit_name: match.kit_name,
                    car_type: match.car_type,
                    number_of_doors: match.number_of_doors,
                    car_variation: match.car_variation,
                    compatible_bar_for_caprock: match.compatible_bar_for_caprock,
                    compatible_rack_for_tent: match.compatible_rack_for_tent,
                    compatible_roof_for_tent: match.compatible_roof_for_tent,
                    foot_attachment: match.foot_attachment,
                    rack_product: match.rack_product,
                    product_score: match.product_score,
                    combined_score: match.combined_score
                };
            }).filter(Boolean);

            console.log('\n=== Final Results ===');
            console.log('Number of filtered matches:', processedMatches.length);
            if (processedMatches.length > 0) {
                console.log('Top match:', {
                    car: `${processedMatches[0].car_make} ${processedMatches[0].car_model}`,
                    description: processedMatches[0].car_description,
                    similarity: processedMatches[0].similarity,
                    product_score: processedMatches[0].product_score,
                    combined_score: processedMatches[0].combined_score
                });
            }

            const enhancedResults = await Promise.all(processedMatches.map(async (match) => {
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
                let matchConfidence: 'high' | 'medium' | 'low' = 'medium';
                if (match.similarity > 0.8) {
                    matchConfidence = 'high';
                } else if (match.similarity < 0.3) {
                    matchConfidence = 'low';
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
                    matchThreshold: 0.0
                }
            });

        } catch (innerErr) {
            console.error('Inner error:', innerErr);
            throw innerErr;
        }

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
    const skuPattern = productIds.map(id => `THU-${id}`).join('|');
    
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
    front_rack_id?: number;
    front_rack_name?: string | null;
    rear_rack_id?: number;
    rear_rack_name?: string | null;
    bar_id?: number;
    bar_name?: string | null;
    foot_id?: number;
    foot_name?: string | null;
    kit_id?: number;
    kit_name?: string | null;
}): Promise<ProductGroup[]> {
    const productGroups: ProductGroup[] = [];
    
    // Collect all product IDs
    const productIds: string[] = [];
    if (match.front_rack_id) productIds.push(match.front_rack_id.toString());
    if (match.rear_rack_id) productIds.push(match.rear_rack_id.toString());
    if (match.bar_id) productIds.push(match.bar_id.toString());
    if (match.foot_id) productIds.push(match.foot_id.toString());
    if (match.kit_id) productIds.push(match.kit_id.toString());

    // Fetch product details from Crystallize
    const productDetails = await fetchProductDetails(productIds);

    // Handle complete racks if present
    const completeRackProducts: Product[] = [];
    if (match.front_rack_id) {
        const frontRackId = match.front_rack_id.toString();
        const details = productDetails.get(frontRackId);
        completeRackProducts.push({
            sku: `THU-${frontRackId}`,
            type: 'complete_rack',
            url: details?.url || null,
            name: details?.name || match.front_rack_name || `Front rack ${match.front_rack_id}`,
            position: 'front'
        });
    }
    if (match.rear_rack_id) {
        const rearRackId = match.rear_rack_id.toString();
        const details = productDetails.get(rearRackId);
        completeRackProducts.push({
            sku: `THU-${rearRackId}`,
            type: 'complete_rack',
            url: details?.url || null,
            name: details?.name || match.rear_rack_name || `Rear rack ${match.rear_rack_id}`,
            position: 'rear'
        });
    }

    if (completeRackProducts.length > 0) {
        productGroups.push({
            type: 'complete_rack',
            isPreferred: true,
            products: completeRackProducts
        });
    }

    // Handle individual components
    const componentProducts: Product[] = [];
    if (match.bar_id) {
        const barId = match.bar_id.toString();
        const details = productDetails.get(barId);
        componentProducts.push({
            sku: `THU-${barId}`,
            type: 'bar',
            url: details?.url || null,
            name: details?.name || match.bar_name || `Bar ${match.bar_id}`
        });
    }
    if (match.foot_id) {
        const footId = match.foot_id.toString();
        const details = productDetails.get(footId);
        componentProducts.push({
            sku: `THU-${footId}`,
            type: 'foot',
            url: details?.url || null,
            name: details?.name || match.foot_name || `Foot ${match.foot_id}`
        });
    }
    if (match.kit_id) {
        const kitId = match.kit_id.toString();
        const details = productDetails.get(kitId);
        componentProducts.push({
            sku: `THU-${kitId}`,
            type: 'kit',
            url: details?.url || null,
            name: details?.name || match.kit_name || `Kit ${match.kit_id}`
        });
    }

    if (componentProducts.length > 0) {
        productGroups.push({
            type: 'individual_components',
            isPreferred: false,
            products: componentProducts
        });
    }

    return productGroups;
} 