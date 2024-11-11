import type { RequestHandler } from './$types';
import { client } from '$lib/crystallizeClient';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
    const productId = url.searchParams.get('id');
    if (!productId) {
        return json({ error: 'Product ID is required' }, { status: 400 });
    }

    const query = `
        query GET_PRODUCT($id: ID!, $language: String!) {
            product {
                get(id: $id, language: $language) {
                    id
                    name
                    variants {
                        id
                        name
                        price
                    }
                }
            }
        }
    `;
    
    try {
        const product = await client.pimApi(query, {
            id: productId,
            language: "en"
        });
        return json(product.product.get);
    } catch (error) {
        console.error('Error fetching product:', error);
        return json({ error: 'Failed to fetch product' }, { status: 400 });
    }
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { productId, price } = await request.json();

        // First get the current product to get the variant details
        const getQuery = `
            query GET_PRODUCT($id: ID!, $language: String!) {
                product {
                    get(id: $id, language: $language) {
                        variants {
                            id
                            sku
                            name
                            isDefault
                        }
                    }
                }
            }
        `;

        const currentProduct = await client.pimApi(getQuery, {
            id: productId,
            language: "en"
        });

        const defaultVariant = currentProduct.product.get.variants[0];

        const mutation = `
            mutation UPDATE_PRODUCT($id: ID!, $language: String!, $input: UpdateProductInput!) {
                product {
                    update(id: $id, language: $language, input: $input) {
                        id
                        name
                        variants {
                            id
                            name
                            sku
                            price
                            isDefault
                        }
                    }
                }
            }
        `;

        const result = await client.pimApi(mutation, {
            id: productId,
            language: "en",
            input: {
                variants: [{
                    id: defaultVariant.id,
                    sku: defaultVariant.sku,
                    name: defaultVariant.name,
                    price: parseFloat(price),
                    isDefault: true
                }]
            }
        });

        return json(result.product.update);
    } catch (error) {
        console.error('Error updating product:', error);
        return json({ error: 'Failed to update product' }, { status: 400 });
    }
};
