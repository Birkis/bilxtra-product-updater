import type { PageServerLoad } from './$types';
import fetch from 'node-fetch';
import { env } from '$env/dynamic/private';
import type { Product, FilterConfig } from '$lib/stores/searchStore';
import { filterProduct } from '$lib/stores/searchStore';

// Extend Product type for API response which includes paginationToken
interface ProductWithPagination extends Product {
    paginationToken: string | null;
}

interface SearchResponse {
    browse: {
        generiskProdukt: {
            hits: ProductWithPagination[];
            summary: {
                totalHits: number;
            };
        };
    };
}

interface ApiResponse {
    data: SearchResponse;
    errors?: Array<{ message: string }>;
}

/**
 * GraphQL query to search for products with pagination support
 */
const SEARCH_PRODUCTS_QUERY = `
  query GET_PRODUCTS($search: String!, $limit: Int!) {
    browse {
      generiskProdukt(
        filters: { sku: { regex: $search } }
        pagination: { limit: $limit }
        publicationState: [published, draft]
      ) {
        hits {
          name
          itemId
          variants {
            sku
            images {
              url
            }
          }
          shortcuts
          productInfo {
            generalProductImages {
              url
            }
          }
          publicationState
          paginationToken
        }
        summary {
          totalHits
        }
      }
    }
  }
`;

const SEARCH_PRODUCTS_WITH_PAGINATION_QUERY = `
  query GET_PRODUCTS($search: String!, $limit: Int!, $after: String!) {
    browse {
      generiskProdukt(
        filters: { sku: { regex: $search } }
        pagination: { limit: $limit, after: $after }
        publicationState: [published, draft]
      ) {
        hits {
          name
          itemId
          variants {
            sku
            images {
              url
            }
          }
          shortcuts
          productInfo {
            generalProductImages {
              url
            }
          }
          publicationState
          paginationToken
        }
        summary {
          totalHits
        }
      }
    }
  }
`;

/**
 * Converts a search string into a regex-safe pattern
 * Makes the search case-insensitive by converting input to uppercase
 */
function createSearchPattern(searchTerm: string): string {
    // Convert search term to uppercase to match SKU format
    const upperSearchTerm = searchTerm.toUpperCase();
    // Escape special regex characters and create a case-insensitive pattern
    const escapedTerm = upperSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `.*${escapedTerm}.*`;
}

/**
 * Helper function to call the Crystallize Discovery API
 */
async function discoveryApiCaller<T = SearchResponse>(
    query: string, 
    variables: { search: string; limit: number; after?: string }
): Promise<T> {
    const response = await fetch(`https://api.crystallize.com/${env.CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });
    
    const result = await response.json() as ApiResponse;
    if (result.errors) {
        throw new Error(result.errors[0].message);
    }
    return result.data as T;
}

/**
 * Recursively fetches all products using pagination
 */
async function fetchAllProducts(searchPattern: string, limit: number = 100): Promise<{ products: Product[], totalCount: number }> {
    const allProducts: Product[] = [];
    let currentToken: string | null = null;
    let hasMore = true;
    let totalHits = 0;

    while (hasMore) {
        const query = currentToken ? SEARCH_PRODUCTS_WITH_PAGINATION_QUERY : SEARCH_PRODUCTS_QUERY;
        const variables = currentToken 
            ? { search: searchPattern, limit, after: currentToken }
            : { search: searchPattern, limit };

        const response = await discoveryApiCaller<SearchResponse>(query, variables);
        const { hits, summary } = response.browse.generiskProdukt;
        
        if (totalHits === 0) {
            totalHits = summary.totalHits;
        }
        
        allProducts.push(...hits);

        const lastItem = hits[hits.length - 1] as ProductWithPagination;
        currentToken = lastItem?.paginationToken;

        hasMore = currentToken != null && hits.length === limit;
    }

    // Deduplicate products by itemId, preferring published versions
    const deduplicatedProducts = Array.from(
        allProducts.reduce((acc, product) => {
            const existingProduct = acc.get(product.itemId);
            if (!existingProduct || product.publicationState === 'published') {
                acc.set(product.itemId, product);
            }
            return acc;
        }, new Map<string, Product>()).values()
    );

    return {
        products: deduplicatedProducts,
        totalCount: deduplicatedProducts.length // Update total count to reflect deduplicated results
    };
}

export const load = (async ({ url }) => {
    const searchTerm = url.searchParams.get('q') || '';
    
    // Parse filter parameters
    const filters: FilterConfig = {
        hasGeneralImage: url.searchParams.get('hasGeneralImage') === 'true' ? true : 
                        url.searchParams.get('hasGeneralImage') === 'false' ? false : 
                        undefined,
        hasShortcuts: url.searchParams.get('hasShortcuts') === 'true' ? true :
                     url.searchParams.get('hasShortcuts') === 'false' ? false :
                     undefined,
        isPublished: url.searchParams.get('isPublished') === 'true' ? true :
                    url.searchParams.get('isPublished') === 'false' ? false :
                    undefined,
        isDraft: url.searchParams.get('isDraft') === 'true' ? true :
                url.searchParams.get('isDraft') === 'false' ? false :
                undefined,
        hasVariantImage: url.searchParams.get('hasVariantImage') === 'true' ? true :
                        url.searchParams.get('hasVariantImage') === 'false' ? false :
                        undefined
    };
    
    if (!searchTerm) {
        return {
            products: [],
            totalCount: 0,
            searchTerm: '',
            filters
        };
    }

    try {
        const searchPattern = createSearchPattern(searchTerm);
        const { products: allProducts, totalCount: totalBeforeFilter } = await fetchAllProducts(searchPattern);

        // Use the imported filterProduct function
        const filteredProducts = allProducts.filter(product => filterProduct(product, filters));

        return {
            products: filteredProducts,
            totalCount: filteredProducts.length,
            totalBeforeFilter,
            searchTerm,
            filters
        };
    } catch (error) {
        console.error('Search query failed:', error);
        return {
            products: [],
            totalCount: 0,
            totalBeforeFilter: 0,
            searchTerm,
            error: 'Failed to fetch products',
            filters
        };
    }
}) satisfies PageServerLoad;