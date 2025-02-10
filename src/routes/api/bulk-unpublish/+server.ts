import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { discoveryApi, nextPimApi } from '$lib/crystallizeClient';

const GET_ITEMID_FROM_SKU = `
query GET_ITEMID_FROM_SKU($sku:String){
  browse {
    generiskProdukt(filters:{sku: {equals:$sku}}) {
      hits {
        itemId
        publicationState
      }
    }
  }
}
`;

const UNPUBLISH_BULK = `
mutation UNPUBLISH_BULK($item_ids:[ID!]!){
  unpublishItems(
    language:"en",
    ids: $item_ids
  ){
    ...on UnpublishItemsRequest{
      success{
        itemId
      }
    }
  }
}
`;

interface UnpublishSuccess {
    itemId: string;
}

interface UnpublishResponse {
    unpublishItems: {
        success: UnpublishSuccess[];
    };
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { skus } = await request.json();
        
        if (!Array.isArray(skus)) {
            return json({ error: 'Invalid input: skus must be an array' }, { status: 400 });
        }

        // Process SKUs in batches to avoid overwhelming the API
        const batchSize = 50;
        const results = {
            successful: [] as string[],
            failed: [] as { sku: string; error: string }[],
            notFound: [] as string[]
        };

        // Keep track of SKU to itemId mapping
        const skuToItemId = new Map<string, string>();

        // Process SKUs in batches
        for (let i = 0; i < skus.length; i += batchSize) {
            const batch = skus.slice(i, i + batchSize);
            const itemIds: string[] = [];

            // Get item IDs for each SKU in the batch
            for (const sku of batch) {
                try {
                    const response = await discoveryApi(GET_ITEMID_FROM_SKU, { sku });
                    const hits = response.browse.generiskProdukt.hits;
                    
                    if (hits && hits.length > 0) {
                        const itemId = hits[0].itemId;
                        itemIds.push(itemId);
                        skuToItemId.set(itemId, sku); // Store the mapping
                    } else {
                        results.notFound.push(sku);
                    }
                } catch (error) {
                    console.error('Error fetching itemId for SKU:', sku, error);
                    results.failed.push({ 
                        sku, 
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            // Unpublish the found items
            if (itemIds.length > 0) {
                try {
                    console.log('Attempting to unpublish items:', itemIds);
                    const response = await nextPimApi(UNPUBLISH_BULK, { item_ids: itemIds });
                    const unpublishResponse = response as UnpublishResponse;
                    console.log('Unpublish response:', unpublishResponse);

                    if (unpublishResponse.unpublishItems?.success) {
                        // Add successfully unpublished items
                        for (const { itemId } of unpublishResponse.unpublishItems.success) {
                            const sku = skuToItemId.get(itemId);
                            if (sku) {
                                results.successful.push(sku);
                            }
                        }

                        // Any items not in the success array are considered failed
                        for (const itemId of itemIds) {
                            if (!unpublishResponse.unpublishItems.success.some(s => s.itemId === itemId)) {
                                const sku = skuToItemId.get(itemId);
                                if (sku) {
                                    results.failed.push({
                                        sku,
                                        error: 'Failed to unpublish'
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Bulk unpublish error:', error);
                    // If the entire batch fails, mark all SKUs as failed
                    itemIds.forEach(itemId => {
                        const sku = skuToItemId.get(itemId);
                        if (sku) {
                            results.failed.push({ 
                                sku,
                                error: error instanceof Error ? error.message : 'Failed to unpublish'
                            });
                        }
                    });
                }
            }
        }

        return json({
            message: 'Bulk unpublish operation completed',
            results
        });
    } catch (error) {
        console.error('Bulk unpublish error:', error);
        return json({ 
            error: 'Failed to process bulk unpublish request',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}; 