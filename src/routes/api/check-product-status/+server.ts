import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { client } from '$lib/crystallizeClient';

export const POST: RequestHandler = async ({ request }) => {
    try {
        console.log('=== Starting product status check ===');
        const { items } = await request.json();
        console.log('Received items:', JSON.stringify(items, null, 2));
        
        if (!Array.isArray(items)) {
            console.log('Error: Invalid request format - items is not an array');
            return json({ error: 'Invalid request format' }, { status: 400 });
        }

        const results = [] as Array<{
            itemId: string;
            sku: string;
            status: {
                exists: boolean;
                isPublished: boolean;
                hasProductImage: boolean;
                details?: string;
            };
        }>;

        // Process items sequentially
        for (const item of items) {
            console.log(`\n=== Checking status for item: ${item.itemId}, SKU: ${item.sku} ===`);
            try {
                let exists = false;
                let isPublished = false;
                let productName = 'Unknown Product';
                let hasProductImage = false;

                // 1. Check publication state using Next PIM API
                console.log('1. Checking publication state with Next PIM API');
                try {
                    const publicationQuery = `
                        query GET_ITEM_STATUS_FROM_ID {
                            item(id: "${item.itemId}", language: "en") {
                                ...on Product {
                                    name
                                    hasVersion(versionLabel: published)
                                }
                            }
                        }
                    `;

                    const publicationResponse = await client.nextPimApi(publicationQuery);
                    console.log('Publication state response:', JSON.stringify(publicationResponse, null, 2));

                    if (publicationResponse?.errors) {
                        console.log('Next PIM API returned errors:', publicationResponse.errors);
                    }

                    exists = !!publicationResponse?.data?.item;
                    isPublished = publicationResponse?.data?.item?.hasVersion || false;
                    productName = publicationResponse?.data?.item?.name || 'Unknown Product';
                } catch (pimError) {
                    console.error('Error querying Next PIM API:', pimError);
                }

                // 2. Check for product image using Discovery API
                console.log('2. Checking for product image with Discovery API');
                try {
                    const imageQuery = `
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

                    const imageResponse = await fetch('https://api.crystallize.com/bilxtra-prod/discovery', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            query: imageQuery
                        }),
                    });

                    const imageData = await imageResponse.json();
                    console.log('Image check response:', JSON.stringify(imageData, null, 2));

                    if (imageData?.errors) {
                        console.log('Discovery API returned errors:', imageData.errors);
                    }

                    const imageHits = imageData?.data?.browse?.generiskProdukt?.hits || [];
                    hasProductImage = imageHits[0]?.productInfo?.generalProductImages?.length > 0;

                    // If Discovery API found the product but Next PIM API didn't, trust Discovery API
                    if (imageHits.length > 0 && !exists) {
                        exists = true;
                        console.log('Product exists according to Discovery API but not found in Next PIM API');
                    }
                } catch (discoveryError) {
                    console.error('Error querying Discovery API:', discoveryError);
                }

                // Compile status
                const status = {
                    exists,
                    isPublished,
                    hasProductImage,
                    details: exists 
                        ? `Product "${productName}" ${isPublished ? 'is' : 'is not'} published and ${hasProductImage ? 'has' : 'does not have'} a product image`
                        : 'Product not found'
                };

                results.push({
                    itemId: item.itemId,
                    sku: item.sku,
                    status
                });

            } catch (error) {
                console.error('Error checking product status:', error);
                results.push({
                    itemId: item.itemId,
                    sku: item.sku,
                    status: {
                        exists: false,
                        isPublished: false,
                        hasProductImage: false,
                        details: error instanceof Error ? error.message : 'Error checking product status'
                    }
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