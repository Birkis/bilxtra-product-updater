import type { RequestHandler } from './$types';
import { client } from '$lib/crystallizeClient';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    try {
        console.log('=== Starting product image update process ===');
        const { items } = await request.json();
        console.log('Received items:', JSON.stringify(items, null, 2));
        
        if (!Array.isArray(items)) {
            console.log('Error: Invalid request format - items is not an array');
            return json({ error: 'Invalid request format' }, { status: 400 });
        }

        const results = {
            updated: 0,
            skipped: 0,
            errors: [] as Array<{ itemId: string; sku: string; error: string; details?: any }>
        };

        // Process items sequentially to avoid rate limiting
        for (const item of items) {
            console.log(`\n=== Processing item: ${item.itemId}, SKU: ${item.sku} ===`);
            try {
                // 1. Get product image using Discovery API
                console.log('1. Fetching product image from Discovery API');
                const productQuery = `
                    query GET_PRODUCT_IMAGE_FROM_ID { 
                        browse {
                            generiskProdukt(
                                filters: {
                                    itemId: {
                                        equals: "${item.itemId}"
                                    }
                                }  
                            ) {
                                hits {
                                    itemId
                                    productInfo {
                                        generalProductImages {
                                            key
                                        }
                                    }
                                }
                            }
                        }
                    }
                `;

                const productResponse = await fetch('https://api.crystallize.com/bilxtra-prod/discovery', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: productQuery
                    }),
                });

                const productData = await productResponse.json();
                console.log('Discovery API response:', JSON.stringify(productData, null, 2));
                
                const hits = productData?.data?.browse?.generiskProdukt?.hits || [];
                
                if (hits.length === 0) {
                    console.log('Error: Product not found');
                    results.errors.push({
                        itemId: item.itemId,
                        sku: item.sku,
                        error: 'Product not found'
                    });
                    continue;
                }

                const imageKey = hits[0]?.productInfo?.generalProductImages?.[0]?.key;
                console.log('Found image key:', imageKey);
                
                if (!imageKey) {
                    console.log('Skipping: No product-level image found');
                    results.skipped++;
                    continue;
                }

                // 2. Update variant image using Legacy PIM API
                console.log('2. Updating variant image using PIM API');
                const updateMutation = `
                    mutation UPDATE_VARIANT_IMAGE($productId: ID!, $imageKey: String!, $sku: String) { 
                        product {
                            updateVariant(
                                productId: $productId
                                sku: $sku
                                language: "en"
                                input: {
                                    images: [
                                        {
                                            key: $imageKey
                                        }
                                    ]
                                }
                            ) {
                                id
                            }
                        }
                    }
                `;

                const variables = {
                    productId: item.itemId,
                    sku: item.sku,
                    imageKey: imageKey
                };
                console.log('PIM API mutation variables:', JSON.stringify(variables, null, 2));

                try {
                    console.log('Calling PIM API...');
                    const updateResponse = await client.pimApi(updateMutation, variables);
                    console.log('PIM API response:', JSON.stringify(updateResponse, null, 2));

                    // Check if we have a successful response
                    if (updateResponse?.product?.updateVariant?.id === item.itemId) {
                        console.log(`Success: Variant image updated (ID: ${item.itemId})`);
                        results.updated++;
                    } else if (updateResponse?.errors) {
                        console.log('Error: PIM API returned errors:', updateResponse.errors);
                        results.errors.push({
                            itemId: item.itemId,
                            sku: item.sku,
                            error: updateResponse.errors[0]?.message || 'Failed to update variant image',
                            details: updateResponse.errors
                        });
                    } else {
                        console.log('Error: Unexpected PIM API response format');
                        results.errors.push({
                            itemId: item.itemId,
                            sku: item.sku,
                            error: 'Unexpected API response format',
                            details: updateResponse
                        });
                    }
                } catch (pimError) {
                    console.error('PIM API error:', pimError);
                    results.errors.push({
                        itemId: item.itemId,
                        sku: item.sku,
                        error: pimError instanceof Error ? pimError.message : 'PIM API error occurred',
                        details: pimError
                    });
                }
            } catch (error) {
                console.error('Error processing item:', error);
                results.errors.push({
                    itemId: item.itemId,
                    sku: item.sku,
                    error: error instanceof Error ? error.message : 'Unknown error occurred',
                    details: error
                });
            }
        }

        console.log('\n=== Final results ===');
        console.log(JSON.stringify(results, null, 2));
        return json(results);
    } catch (error) {
        console.error('Error in API handler:', error);
        return json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}; 