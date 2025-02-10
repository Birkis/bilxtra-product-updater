import type { PageServerLoad } from './$types';
import { filterProduct } from '$lib/stores/searchStore';
import type { ApiProductSearchResult, TransformedProduct } from '$lib/types/search';
import { parseSearchParams, parseFilters } from '$lib/types/search';

export const load = (async ({ url, fetch }) => {
    const searchParams = parseSearchParams(url.searchParams);
    const filters = parseFilters(searchParams);
    
    if (!searchParams.q) {
        return {
            products: [],
            totalCount: 0,
            totalBeforeFilter: 0,
            searchTerm: '',
            filters
        };
    }

    try {
        // Use the product-search API endpoint
        const response = await fetch(`/api/product-search?q=${encodeURIComponent(searchParams.q)}`);
        if (!response.ok) {
            throw new Error('Search request failed');
        }
        
        const allProducts: ApiProductSearchResult[] = await response.json();
        
        // Transform the API response to match our Product type
        const transformedProducts: TransformedProduct[] = allProducts.map(product => ({
            name: product.name,
            variants: [{
                sku: product.variant.sku,
                images: product.variant.image ? [{ url: product.variant.image.url }] : []
            }],
            shortcuts: product.shortcuts || [],
            productInfo: null,
            publicationState: '',
            itemId: product.itemId,
            score: product.score
        }));

        // Apply filters
        const filteredProducts = transformedProducts.filter(product => filterProduct(product, filters));

        return {
            products: filteredProducts,
            totalCount: filteredProducts.length,
            totalBeforeFilter: transformedProducts.length,
            searchTerm: searchParams.q,
            filters
        };
    } catch (error) {
        console.error('Search query failed:', error);
        return {
            products: [],
            totalCount: 0,
            totalBeforeFilter: 0,
            searchTerm: searchParams.q,
            error: 'Failed to fetch products',
            filters
        };
    }
}) satisfies PageServerLoad;