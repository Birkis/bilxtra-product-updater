import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private'; 
import { client } from '$lib/crystallizeClient';

// Discovery API caller (as you provided)
async function discoveryApiCaller<T = any>(query: string, variables: Record<string, any>): Promise<T> {
    return fetch(`https://api.crystallize.com/${env.CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })
      .then((response) => response.json())
      .then((response: { data: T }) => response.data);
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { items } = await request.json();

        if (!Array.isArray(items) || items.length === 0) {
            return json({ error: "No items provided" }, { status: 400 });
        }

        const discoveryQuery = `
        query GET_PRODUCT_IMAGE($sku: String!) { 
            browse {
                generiskProdukt(filters: {sku:{equals:$sku}}  ) {
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
        }`;

        const results = [];

        for (const item of items) {
            const { productId, productSku, variantSku } = item;

            if (!productId || !productSku || !variantSku) {
                results.push({
                    ...item,
                    status: 'error',
                    error: 'Missing productId, productSku, or variantSku'
                });
                continue;
            }

            // 1. Fetch product-level image keys from Discovery
            const data = await discoveryApiCaller(discoveryQuery, { sku: productSku });

            const hits = data?.browse?.generiskProdukt?.hits ?? [];
            if (hits.length === 0) {
                results.push({
                    ...item,
                    status: 'error',
                    error: 'No product found for the given productSku'
                });
                continue;
            }

            const productInfo = hits[0].productInfo;
            const images = productInfo?.generalProductImages ?? [];

            if (images.length === 0) {
                results.push({
                    ...item,
                    status: 'error',
                    error: 'No images found at product level'
                });
                continue;
            }

            const imageKey = images[0].key;

            // 2. Mutate using the PIM API to set the variant image
            const mutation = `
            mutation UPDATE_VARIANT_IMAGE($productId: ID!, $variantSku: String!, $imageKey: String!) {
              product {
                updateVariant(
                  productId: $productId
                  sku: $variantSku
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
            }`;

            try {
                const pimResponse = await client.pimApi(mutation, {
                    productId,
                    variantSku,
                    imageKey
                });

                if (pimResponse?.product?.updateVariant?.id) {
                    results.push({
                        productId,
                        variantSku,
                        status: 'success',
                        variantId: pimResponse.product.updateVariant.id
                    });
                } else {
                    results.push({
                        productId,
                        variantSku,
                        status: 'error',
                        error: 'Variant update did not return an ID'
                    });
                }
            } catch (err: any) {
                results.push({
                    productId,
                    variantSku,
                    status: 'error',
                    error: err.message
                });
            }
        }

        return json({ results });
    } catch (error: any) {
        return json({ error: error.message }, { status: 500 });
    }
};