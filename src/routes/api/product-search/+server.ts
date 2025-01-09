import type { RequestHandler } from './$types';
import { discoveryApi } from '$lib/crystallizeClient';

interface ProductImage {
    url: string;
    key: string;
}

interface ProductVariant {
    sku: string;
    name: string;
    images: ProductImage[];
}

interface ProductHit {
    shortcuts: string[];
    name: string;
    itemId: string;
    defaultVariant: ProductVariant;
}

interface SearchResponse {
    search: {
        hits: ProductHit[];
    };
}

interface ProcessedResult {
    name: string;
    itemId: string;
    url: string;
    variant: {
        sku: string;
        name: string;
        image: ProductImage;
    };
}

export const GET: RequestHandler = async ({ url }) => {
    const searchTerm = url.searchParams.get('q');
    
    if (!searchTerm) {
        return new Response(JSON.stringify({ error: 'Search term is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const query = `
        query FIND_PRODUCTS($search_term: String) {
            search(
                filters: {
                    productInfo_description_body_plainText: {
                        contains: $search_term
                    }
                }
            ) {
                hits {
                    ... on Product {
                        shortcuts
                        name
                        itemId
                        defaultVariant {
                            sku
                            name
                            images {
                                url
                                key
                            }
                        }
                    }
                }
            }
        }
    `;

    try {
        console.log('Executing search query with term:', searchTerm);
        const data = await discoveryApi<SearchResponse>(query, { search_term: searchTerm });
        
        // Process the results
        const processedResults = data.search.hits
            .slice(0, 5) // Limit to top 5 results
            .map(hit => {
                // Find the first shortcut that starts with '/categories'
                const validShortcut = hit.shortcuts.find(s => s.startsWith('/categories'));
                if (!validShortcut) return null;

                // Remove '/categories' from the path
                const cleanPath = validShortcut.replace(/^\/categories/, '');

                // Get the first image if available
                const firstImage = hit.defaultVariant?.images?.[0];
                if (!firstImage) return null;

                return {
                    name: hit.name,
                    itemId: hit.itemId,
                    url: `https://bilxtra.no${cleanPath}`,
                    variant: {
                        sku: hit.defaultVariant.sku,
                        name: hit.defaultVariant.name,
                        image: firstImage
                    }
                };
            })
            .filter((result): result is ProcessedResult => result !== null);

        return new Response(JSON.stringify(processedResults), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Search error details:', {
            error,
            query,
            searchTerm,
            stack: error instanceof Error ? error.stack : undefined
        });
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