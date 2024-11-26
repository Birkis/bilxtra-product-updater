import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import fetch from 'node-fetch';

export const GET: RequestHandler = async ({ url }) => {
    const sku = url.searchParams.get('sku');
    
    if (!sku) {
        return json({ exists: false, error: 'No SKU provided' }, { status: 400 });
    }

    const query = `
        query FIND_SKU($sku: String) { 
            browse {
                generiskProdukt(filters: {sku: {equals: $sku}}) {
                    hits {
                        variants {
                            sku
                        }
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch(`https://api.crystallize.com/${env.CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                variables: { sku }
            }),
        });

        const data = await response.json();
        
        if (data.errors) {
            console.error('GraphQL errors:', data.errors);
            return json({ exists: false, error: data.errors[0].message }, { status: 400 });
        }

        // Check if we have any hits with matching SKU
        const exists = data.data?.browse?.generiskProdukt?.hits?.some(hit => 
            hit.variants?.some(variant => variant.sku === sku)
        ) ?? false;

        return json({ exists });

    } catch (error) {
        console.error('Error checking SKU existence:', error);
        return json({ exists: false, error: 'Failed to check SKU existence' }, { status: 500 });
    }
}; 