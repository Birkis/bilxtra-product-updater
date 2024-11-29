import type { RequestHandler } from './$types';
import { client } from '$lib/crystallizeClient';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    try {
        // Get product ID and name from request body
        const { id, name } = await request.json();

        const mutation = `
            mutation UPDATE_NAME($id: ID!, $name: String!) {
                product {
                    update(
                        id: $id,
                        language: "en",
                        input: { name: $name }
                    ) {
                        name
                    }
                }
            }
        `;

        

        const response = await client.pimApi(mutation, {
            id: id,
            name: name
        });

        return json(response);
    } catch (error) {
        return json({ error: error.message }, { status: 500 });
    }
};