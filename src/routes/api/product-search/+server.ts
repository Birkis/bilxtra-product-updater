import type { RequestHandler } from './$types';
import { discoveryApi } from '$lib/crystallizeClient';

interface ProductImage {
    url: string;
    key: string;
}

interface ProductVariant {
    sku: string;
    name: string;
    image: ProductImage;
    price: number;
    priceExVat: number;
    stock: number;
    totalStock: number;
}

interface ProductInfo {
    description: {
        body: {
            plainText: string;
        };
    };
}


interface SearchResponse {
    browse: {
        generiskProdukt: {
            hits: Array<{
                name: string;
                score: number;
                shortcuts: string[];
                topics: Record<string, unknown>;
                itemId: string;
                defaultVariant: {
                    sku: string;
                    name: string;
                    firstImage: ProductImage;
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

interface ProcessedResult {
    name: string;
    itemId: string;
    url: string;
    score: number;
    variant: ProductVariant;
}

// Function to fetch all results using pagination
async function fetchAllResults(searchTerm: string): Promise<ProcessedResult[]> {
    let allResults: ProcessedResult[] = [];
    let paginationToken: string | null = null;
    let hasMore = true;

    while (hasMore) {
        const query: string = `
            query FIND_PRODUCTS_BROWSE_REGEX($search_term: String!${paginationToken ? ', $paginationToken: String' : ''}) {
                browse {
                    generiskProdukt(
                        pagination: {
                            limit: 100
                            ${paginationToken ? 'after: $paginationToken' : ''}
                        }
                        term: $search_term
                        options: {
                            fuzzy: {

                                fuzziness: DOUBLE,
                                maxExpensions: 50

                            }
                        }
                        sorting: {
                            score: desc
                        }
                    ) {
                        hits {
                            name
                            score
                            shortcuts
                            topics
                            itemId
                            defaultVariant {
                                sku
                                name
                                firstImage {
                                    url
                                    key
                                }
                                defaultPrice
                                defaultStock
                                stockLocations
                            }
                            paginationToken
                        }
                        summary {
                            totalHits
                            hasMoreHits
                            hasPreviousHits
                        }
                    }
                }
            }
        `;

        const variables: { search_term: string; paginationToken?: string } = {
            search_term: searchTerm,
            ...(paginationToken && { paginationToken })
        };

        const data = await discoveryApi<SearchResponse>(query, variables);
        const hits = data.browse.generiskProdukt.hits;
        
        // Process hits into our response format
        const processedHits = hits.map(hit => {
            // Get the first valid shortcut or use a default path
            const validShortcut = hit.shortcuts?.find((s: string) => s.startsWith('/categories')) || '/ukategorisert';
            const cleanPath = validShortcut.replace(/^\/categories/, '');
            
            // Calculate total stock across locations
            const totalStock = Object.values(hit.defaultVariant?.stockLocations || {})
                .reduce((sum: number, location: { stock: number }) => sum + (location.stock || 0), 0);

            const priceExVat = hit.defaultVariant?.defaultPrice || 0;
            const priceWithVat = Number((priceExVat * 1.25).toFixed(2));

            return {
                name: hit.name,
                itemId: hit.itemId,
                url: `https://bilxtra.no${cleanPath}`,
                score: calculateScore(hit, searchTerm),
                shortcuts: hit.shortcuts || [],
                topics: hit.topics || {},
                variant: {
                    sku: hit.defaultVariant?.sku || '',
                    name: hit.defaultVariant?.name || '',
                    image: hit.defaultVariant?.firstImage || {
                        url: 'https://bilxtra.no/images/no-image.jpg',
                        key: 'default/no-image'
                    },
                    price: priceWithVat,
                    priceExVat: priceExVat,
                    stock: hit.defaultVariant?.defaultStock || 0,
                    totalStock
                }
            };
        });

        allResults = [...allResults, ...processedHits];
        
        hasMore = data.browse.generiskProdukt.summary.hasMoreHits;
        if (hasMore && hits.length > 0) {
            paginationToken = hits[hits.length - 1].paginationToken;
        }
    }

    return allResults;
}

export const GET: RequestHandler = async ({ url }) => {
    const searchTerm = url.searchParams.get('q');
    
    if (!searchTerm) {
        return new Response(JSON.stringify({ error: 'Search term is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const results = await fetchAllResults(searchTerm);
        
        // Filter results to ensure minimum stock and sort by score
        const filteredResults = results
            .filter(result => result.variant.totalStock >= 3)
            .sort((a, b) => b.score - a.score);

        return new Response(JSON.stringify(filteredResults), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Search error:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to perform search',
            details: error instanceof Error ? error.message : 'Unknown error',
            searchTerm
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}; 