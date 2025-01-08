import type { RequestHandler } from './$types';
import { discoveryApi } from '$lib/crystallizeClient';

interface ProductHit {
    shortcuts: string[];
    name: string;
    itemId: string;
}

interface SearchResponse {
    search: {
        hits: ProductHit[];
    };
}

interface ProcessedResult {
    name: string;
    itemId: string;
    url: string | null;
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
            search(filters: {
                productInfo_description_body_plainText: {
                    contains: $search_term
                }
            }) {
                hits {
                    shortcuts
                    name
                    itemId
                }
            }
        }
    `;

    try {
        const data = await discoveryApi<SearchResponse>(query, { search_term: searchTerm });
        
        // Process the results
        const processedResults = data.search.hits
            .slice(0, 5) // Limit to top 5 results
            .map((hit: ProductHit): ProcessedResult => {
                // Find the first shortcut that starts with '/categories'
                const validShortcut = hit.shortcuts.find((s: string) => s.startsWith('/categories'));
                if (!validShortcut) return { name: hit.name, itemId: hit.itemId, url: null };
                
                // Remove '/categories' from the path
                const cleanPath = validShortcut.replace(/^\/categories/, '');
                return {
                    name: hit.name,
                    itemId: hit.itemId,
                    url: `https://bilxtra.no${cleanPath}`
                };
            })
            .filter((result: ProcessedResult) => result.url !== null);

        return new Response(JSON.stringify(processedResults), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        return new Response(JSON.stringify({ error: 'Failed to perform search' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}; 