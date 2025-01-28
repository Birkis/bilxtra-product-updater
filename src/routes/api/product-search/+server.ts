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
    defaultPrice: number;
    defaultStock: number;
    stockLocations: Record<string, { stock: number }>;
}

interface ProductInfo {
    description: {
        body: {
            plainText: string;
        };
    };
}

interface ProductHit {
    shortcuts: string[];
    name: string;
    itemId: string;
    score: number;
    topics: Record<string, unknown>;
    paginationToken: string;
    defaultVariant: ProductVariant;
    description?: string;
    url: string;
    variant?: {
        sku: string;
        name: string;
        image?: {
            url: string;
            key: string;
        };
        price: number;
        stock: number;
        totalStock: number;
    };
}

interface SearchResponse {
    browse: {
        generiskProdukt: {
            hits: ProductHit[];
            summary: {
                totalHits: number;
                hasMoreHits: boolean;
                hasPreviousHits: boolean;
            }
        }
    };
}

interface ProcessedResult {
    name: string;
    itemId: string;
    url: string;
    score: number;
    variant: {
        sku: string;
        name: string;
        image: ProductImage;
        price: number;
        priceExVat: number;
        stock: number;
        totalStock: number;
    };
}

// Function to fetch all results using pagination
async function fetchAllResults(query: string, searchTerm: string): Promise<ProductHit[]> {
    let allHits: ProductHit[] = [];
    let paginationToken: string | null = null;
    let hasMore = true;

    while (hasMore) {
        const paginationQuery: string = `
            query FIND_PRODUCTS_BROWSE_REGEX($search_term: String!, $path_term: String!${paginationToken ? ', $after: String' : ''}) {
                browse {
                    generiskProdukt(
                        pagination: {
                            limit: 100
                            ${paginationToken ? 'after: $after' : ''}
                        }
                        filters: {
                            OR: [
                                { shortcuts_path: { regex: $path_term }},
                                { topics: { contains: $search_term }}
                                { name: { contains: $search_term }},
                            ]
                        }
                    ) {
                        hits {
                            ... on Product {
                                publicationState
                                topics
                                score
                                name
                                itemId
                                shortcuts
                                defaultVariant {
                                    sku
                                    name
                                    images {
                                        url
                                        key
                                    }
                                    defaultPrice
                                    defaultStock
                                    stockLocations
                                }
                                paginationToken
                            }
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

        const variables: { search_term: string; path_term: string; after?: string } = {
            search_term: searchTerm,
            path_term: searchTerm.replace(/ø/g, 'o').toLowerCase(),
            ...(paginationToken && { after: paginationToken })
        };

        console.log('Fetching page with token:', paginationToken);
        const data = await discoveryApi<SearchResponse>(paginationQuery, variables);
        
        const hits = data.browse.generiskProdukt.hits;
        allHits = [...allHits, ...hits];
        
        hasMore = data.browse.generiskProdukt.summary.hasMoreHits;
        if (hasMore && hits.length > 0) {
            paginationToken = hits[hits.length - 1].paginationToken;
        }

        console.log(`Fetched ${hits.length} results. Total so far: ${allHits.length}. Has more: ${hasMore}`);
    }

    return allHits;
}

// Function to create smart regex patterns for search
function createSmartRegexPattern(searchTerm: string): { searchPattern: string; pathPattern: string } {
    // Normalize the search term by handling Norwegian characters for path search
    const normalizedTerm = searchTerm
        .replace(/ø/g, 'o')
        .replace(/æ/g, 'ae')
        .replace(/å/g, 'a');

    // Split into words and create pattern that matches each word
    const words = searchTerm.trim().split(/\s+/);
    
    // Create a pattern that matches any of the words
    const wordPatterns = words.map(word => {
        // Escape special regex characters
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match the word with optional word boundaries
        return `(${escaped})`; 
    });

    // Same for normalized path search
    const normalizedWords = normalizedTerm.split(/\s+/);
    const normalizedPatterns = normalizedWords.map(word => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return `(${escaped})`;
    });

    // Combine patterns - require at least one word to match
    const searchPattern = `.*${wordPatterns.join('|')}.*`;
    const pathPattern = `.*${normalizedPatterns.join('|')}.*`;

    console.log('Generated patterns:', { searchPattern, pathPattern });
    return { searchPattern, pathPattern };
}

// Function to calculate relevance score based on match location
function calculateScore(hit: ProductHit, searchTerm: string): number {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const lowerName = hit.name.toLowerCase();
    const words = lowerSearchTerm.split(/\s+/);

    // Check if this is a pressure cleaner
    const skuPrefix = hit.variant?.sku?.substring(0, 4) || '';
    const isAvaPressureCleaner = skuPrefix === 'AVA-' && hit.variant?.sku?.startsWith('AVA-10-');
    const isKranzlePressureCleaner = skuPrefix === 'ACN-' && hit.variant?.sku?.startsWith('ACN-KR');
    const isCarwisePressureCleaner = hit.name.toLowerCase().includes('carwise') && hit.name.toLowerCase().includes('høytrykk');
    const isPressureCleaner = (isAvaPressureCleaner || isKranzlePressureCleaner || isCarwisePressureCleaner) &&
        !hit.name.toLowerCase().includes('tilbehør') &&
        !hit.name.toLowerCase().includes('service') &&
        !hit.name.toLowerCase().includes('kit') &&
        !hit.name.toLowerCase().includes('børste') &&
        !hit.name.toLowerCase().includes('slange') &&
        !hit.name.toLowerCase().includes('adapter') &&
        !hit.name.toLowerCase().includes('dyse') &&
        !hit.name.toLowerCase().includes('lanse');

    let score = 0;

    // Boost for pressure cleaners when searching for related terms
    if (isPressureCleaner && 
        (lowerSearchTerm.includes('høytrykk') || 
         lowerSearchTerm.includes('spyler') || 
         lowerSearchTerm.includes('vasker'))) {
        score += 40.0;
    }

    // Full phrase match
    if (lowerName.includes(lowerSearchTerm)) {
        score += 15.0;
        // Extra boost if it's at the start
        if (lowerName.startsWith(lowerSearchTerm)) {
            score += 10.0;
        }
    }

    // Individual word matches
    let exactWordMatches = 0;
    words.forEach(word => {
        const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'i');
        if (wordBoundaryRegex.test(lowerName)) {
            score += 3.0;
            exactWordMatches++;
            
            // Extra points for matches at the start of words
            if (new RegExp(`\\b${word}`, 'i').test(lowerName)) {
                score += 2.0;
            }
        } else if (lowerName.includes(word)) {
            // Partial match (part of another word)
            score += 1.0;
            // Penalty if it's part of a longer word
            score -= 3.0;
        }
    });

    // Bonus if all search words are found
    if (exactWordMatches === words.length) {
        score += 6.0;
        // Extra bonus if they appear in the same order
        const orderedRegex = new RegExp(words.join('.*'), 'i');
        if (orderedRegex.test(lowerName)) {
            score += 4.0;
        }
    }

    // URL/category matches
    const url = hit.url?.toLowerCase() || '';
    if (url.includes('hoytrykkspyler')) {
        score += isPressureCleaner ? 5.0 : 1.0;
    }

    // Topic matches
    if (hit.topics) {
        Object.values(hit.topics).forEach((value: any) => {
            if (typeof value === 'string' && value.toLowerCase().includes(lowerSearchTerm)) {
                score += isPressureCleaner ? 4.0 : 1.0;
            }
        });
    }

    // Quality signals
    if (hit.variant?.image?.url && !hit.variant.image.url.includes('no-image')) {
        score += 1.0;
    }
    if (hit.variant?.totalStock && hit.variant.totalStock > 10) {
        score += 1.0;
    }

    // Price-based boost for actual machines
    const price = hit.variant?.price ?? 0;
    if (price >= 3000) {
        score += 5.0;
    }

    // Normalize to a max of 50
    return Math.min(Math.max(score, 0), 50);
}

export const GET: RequestHandler = async ({ url }) => {
    const searchTerm = url.searchParams.get('q');
    
    if (!searchTerm) {
        return new Response(JSON.stringify({ error: 'Search term is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Create smart regex patterns for search
    const { searchPattern, pathPattern } = createSmartRegexPattern(searchTerm);

    try {
        console.log('Executing search query with patterns:', { searchPattern, pathPattern });
        const allHits = await fetchAllResults(searchPattern, pathPattern);
        
        console.log('Total hits fetched:', allHits.length);
        
        // Process and sort the results
        console.log('Raw results count:', allHits.length);
        const processedResults = allHits
            .map(hit => {
                // Find the first shortcut that starts with '/categories' or use a default path
                let cleanPath = '/ukategorisert';
                const validShortcut = hit.shortcuts.find(s => s.startsWith('/categories'));
                if (validShortcut) {
                    cleanPath = validShortcut.replace(/^\/categories/, '');
                }

                // Get the first image if available
                const firstImage = hit.defaultVariant?.images?.[0] || {
                    url: 'https://bilxtra.no/images/no-image.jpg',
                    key: 'default/no-image'
                };

                // Calculate total stock across all locations
                const totalStock = Object.values(hit.defaultVariant?.stockLocations || {})
                    .reduce((sum, location) => sum + (location.stock || 0), 0);

                // Create a consistent variant structure before scoring
                const priceExVat = hit.defaultVariant?.defaultPrice || 0;
                const priceWithVat = Number((priceExVat * 1.25).toFixed(2));

                const variant = {
                    sku: hit.defaultVariant?.sku || '',
                    name: hit.defaultVariant?.name || '',
                    image: firstImage,
                    price: priceWithVat,
                    priceExVat: priceExVat,
                    stock: hit.defaultVariant?.defaultStock || 0,
                    totalStock
                };

                // Set the URL and variant before scoring
                hit.url = `https://bilxtra.no${cleanPath}`;
                hit.variant = variant;

                const score = calculateScore(hit, searchTerm);
                console.log(`Score for ${hit.name}:`, score);

                return {
                    name: hit.name,
                    itemId: hit.itemId,
                    url: hit.url,
                    score,
                    variant
                };
            })
            .sort((a, b) => b.score - a.score)
            .filter(result => {
                const filtered = result.score > 0 && result.variant.totalStock >= 3;
                if (!filtered) {
                    console.log(`Filtered out ${result.name} - score: ${result.score}, totalStock: ${result.variant.totalStock}`);
                }
                return filtered;
            });

        console.log('Final processed results:', processedResults);
        return new Response(JSON.stringify(processedResults), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Search error details:', {
            error,
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