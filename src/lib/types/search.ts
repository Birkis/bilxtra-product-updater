import type { FilterConfig } from '$lib/stores/searchStore';

export interface ApiProductSearchResult {
    name: string;
    variant: {
        sku: string;
        image?: { url: string };
    };
    shortcuts?: string[];
    itemId: string;
    score: number;
}

export interface TransformedProduct {
    name: string;
    variants: Array<{
        sku: string;
        images: Array<{ url: string }>;
    }>;
    shortcuts: string[];
    productInfo: null;
    publicationState: string;
    itemId: string;
    score: number;
}

export interface SearchPageData {
    products: TransformedProduct[];
    totalCount: number;
    totalBeforeFilter: number;
    searchTerm: string;
    filters: FilterConfig;
    error?: string;
}

export interface SearchParams {
    q?: string;
    hasGeneralImage?: string;
    hasShortcuts?: string;
    isPublished?: string;
    isDraft?: string;
    hasVariantImage?: string;
}

export function parseSearchParams(params: URLSearchParams): SearchParams {
    return {
        q: params.get('q') || undefined,
        hasGeneralImage: params.get('hasGeneralImage') || undefined,
        hasShortcuts: params.get('hasShortcuts') || undefined,
        isPublished: params.get('isPublished') || undefined,
        isDraft: params.get('isDraft') || undefined,
        hasVariantImage: params.get('hasVariantImage') || undefined
    };
}

export function parseFilters(params: SearchParams): FilterConfig {
    return {
        hasGeneralImage: params.hasGeneralImage === 'true' ? true : 
                        params.hasGeneralImage === 'false' ? false : 
                        undefined,
        hasShortcuts: params.hasShortcuts === 'true' ? true :
                     params.hasShortcuts === 'false' ? false :
                     undefined,
        isPublished: params.isPublished === 'true' ? true :
                    params.isPublished === 'false' ? false :
                    undefined,
        isDraft: params.isDraft === 'true' ? true :
                params.isDraft === 'false' ? false :
                undefined,
        hasVariantImage: params.hasVariantImage === 'true' ? true :
                        params.hasVariantImage === 'false' ? false :
                        undefined
    };
} 