import { writable, derived } from 'svelte/store';

// Types
export interface ProductVariant {
    sku: string;
    images?: Array<{ url: string }> | null;
}

export interface ProductInfo {
    generalProductImages: Array<{ url: string }> | null;
}

export interface Product {
    name: string;
    variants: Array<{
        sku: string;
        images: Array<{ url: string }>;
    }>;
    shortcuts: string[];
    productInfo: any;
    publicationState: string;
    itemId: string;
    // Add new fields for search ranking
    score?: number;
    topics?: string[];
    combinedScore?: number;  // Field to store our custom scoring
}

export interface FilterConfig {
    hasGeneralImage?: boolean;
    hasShortcuts?: boolean;
    isPublished?: boolean;
    isDraft?: boolean;
    hasVariantImage?: boolean;
}

interface SearchState {
    rawResults: Product[];
    filters: FilterConfig;
    searchTerm: string;
    totalBeforeFilter: number;
    isLoading: boolean;
    error: string | null;
}

// Initial state
const initialState: SearchState = {
    rawResults: [],
    filters: {},
    searchTerm: '',
    totalBeforeFilter: 0,
    isLoading: false,
    error: null
};

// Export the filter function so it can be used by the server
export function filterProduct(product: Product, filters: FilterConfig): boolean {
    if (filters.hasGeneralImage !== undefined) {
        const hasImage = Boolean(product.productInfo?.generalProductImages?.length);
        if (hasImage !== filters.hasGeneralImage) return false;
    }

    if (filters.hasShortcuts !== undefined) {
        const hasShortcuts = Boolean(product.shortcuts?.length);
        if (hasShortcuts !== filters.hasShortcuts) return false;
    }

    if (filters.isPublished !== undefined) {
        const isPublished = product.publicationState === 'published';
        if (isPublished !== filters.isPublished) return false;
    }

    if (filters.isDraft !== undefined) {
        const isDraft = product.publicationState === 'draft';
        if (isDraft !== filters.isDraft) return false;
    }

    if (filters.hasVariantImage !== undefined) {
        const hasVariantImage = product.variants.some(variant => 
            Boolean(variant.images?.length)
        );
        if (hasVariantImage !== filters.hasVariantImage) return false;
    }

    return true;
}

const calculateCombinedScore = (product: Product): number => {
    const baseScore = product.score || 0;
    const topicsBonus = product.topics && product.topics.length > 0 ? 0.5 : 0;
    return baseScore + topicsBonus;
};

export const processSearchResults = (results: any[]): Product[] => {
    const products = results.map((result) => ({
        name: result.name,
        variants: result.variants,
        shortcuts: result.shortcuts || [],
        productInfo: result.productInfo,
        publicationState: result.publicationState,
        itemId: result.itemId,
        score: result._score,
        topics: result.topics,
        combinedScore: 0, // Initialize with 0
    } as Product));

    // Calculate combined scores and sort
    products.forEach(product => {
        product.combinedScore = calculateCombinedScore(product);
    });

    return products.sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0));
};

// Create the store
function createSearchStore() {
    const { subscribe, set, update } = writable<SearchState>(initialState);

    // Derived store for filtered results
    const filteredResults = derived(
        { subscribe },
        ($state) => {
            return {
                products: $state.rawResults.filter(product => filterProduct(product, $state.filters)),
                totalCount: $state.rawResults.filter(product => filterProduct(product, $state.filters)).length,
                totalBeforeFilter: $state.totalBeforeFilter,
                searchTerm: $state.searchTerm,
                error: $state.error,
                isLoading: $state.isLoading
            };
        }
    );

    return {
        subscribe: filteredResults.subscribe,
        setRawResults: (products: Product[], totalCount: number) => 
            update(state => ({ ...state, rawResults: products, totalBeforeFilter: totalCount })),
        setFilters: (filters: FilterConfig) => 
            update(state => ({ ...state, filters })),
        setSearchTerm: (term: string) => 
            update(state => ({ ...state, searchTerm: term })),
        setLoading: (isLoading: boolean) => 
            update(state => ({ ...state, isLoading })),
        setError: (error: string | null) => 
            update(state => ({ ...state, error })),
        reset: () => set(initialState)
    };
}

// Export the store instance
export const searchStore = createSearchStore(); 