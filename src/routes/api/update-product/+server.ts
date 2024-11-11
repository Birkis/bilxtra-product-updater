import type { RequestHandler } from './$types';
import { client } from '$lib/crystallizeClient';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
    const productId = '668795917a3c149f55b32271';

    const query = `
        query GET_PRODUCT($id: ID!, $language: String!) {
            product {
                get(id: $id, language: $language) {
                    id
                    name
                    components {
                        componentId
                        name
                        type
                        content {
                            ... on PieceContent {
                                components {
                                    componentId
                                    name
                                    type
                                    content {
                                        ... on ParagraphCollectionContent {
                                            paragraphs {
                                                title {
                                                    text
                                                }
                                                body {
                                                    json
                                                    html
                                                    plainText
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            ... on ComponentMultipleChoiceContent {
                                selectedComponents {
                                    componentId
                                    name
                                    content {
                                        ... on NumericContent {
                                            number
                                            unit
                                        }
                                    }
                                }
                            }
                        }
                    }
                    variants {
                        id
                        name
                        sku
                        price
                        stock
                        images {
                            url
                            altText
                            variants {
                                url
                                width
                            }
                        }
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
    const productId = '66879591b45a5bf605ade415';
    const data = await request.json();

    // First, get the current product data
    const getQuery = `
        query GET_PRODUCT($id: ID!, $language: String!) {
            product {
                get(id: $id, language: $language) {
                    id
                    name
                    variants {
                        id
                        name
                        sku
                        price
                        stock
                        isDefault
                        images {
                            url
                        }
                    }
                }
            }
        }
    `;

    try {
        // Get current product data
        const currentProduct = await client.pimApi(getQuery, {
            id: productId,
            language: "en"
        });

        const currentVariant = currentProduct.product.get.variants[0];

        // Update mutation
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
                            stock
                            isDefault
                            images {
                                url
                            }
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
                    id: currentVariant.id,
                    name: currentVariant.name,
                    sku: currentVariant.sku,
                    price: data.variants[0].price, // Only update the price
                    stock: currentVariant.stock,
                    isDefault: true,
                    images: currentVariant.images
                }]
            }
        });

        return json(result.product.update);
    } catch (error) {
        console.error('Error updating product:', error);
        return json({ error: 'Failed to update product' }, { status: 400 });
    }
};