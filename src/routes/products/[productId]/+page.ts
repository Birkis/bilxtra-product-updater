import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, fetch }) => {
    try {
        const response = await fetch(`/api/update-product?id=${params.productId}`);
        if (!response.ok) throw new Error('Failed to fetch product');
        const product = await response.json();
        
        return {
            product
        };
    } catch (err) {
        throw error(404, 'Product not found');
    }
};

