import type { PageLoad } from './$types';

/**
 * Product variant interface
 */
interface ProductVariant {
    sku: string;
}

/**
 * Product interface representing the structure of product data
 */
export interface Product {
    name: string;
    variants: ProductVariant[];
    paginationToken: string | null;
}

/**
 * Search page data interface
 */
export interface SearchPageData {
    products: Product[];
    searchTerm: string;
    error?: string;
}

export const load = (({ data }) => {
    return data;
}) satisfies PageLoad;