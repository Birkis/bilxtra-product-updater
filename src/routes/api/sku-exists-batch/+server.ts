import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET({ url }: RequestEvent) {
    const skus = url.searchParams.getAll('skus');
    
    try {
        // Replace this with your actual database query
        const results = await Promise.all(
            skus.map(async (sku) => ({
                sku,
                exists: false // Query your database here
            }))
        );

        return json({ results });
    } catch (error) {
        return json({ error: 'Failed to check SKUs' }, { status: 500 });
    }
} 