import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SKUFields } from '$lib/types/sku';
import type { ComponentMapping } from '$lib/types/componentMapping';
import { client } from '$lib/crystallizeClient';
import rawMapping from '$lib/componentMapping.yaml';
import { env } from '$env/dynamic/private';

async function getItemIdFromSku(sku: string) {
    const query = `
        query GET_ITEMID($sku: String!) {
            browse {
                generiskProdukt(filters: { sku: { equals: $sku } }) {
                    hits {
                        itemId
                    }
                }
            }
        }
    `;

    const variables = {
        sku: sku
    };

    const response = await fetch(`https://api.crystallize.com/${env.CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });

    const jsonResponse = await response.json();
    const itemId = jsonResponse.data?.browse?.generiskProdukt?.hits?.[0]?.itemId;
    
    if (!itemId) {
        throw new Error(`No item found for SKU: ${sku}`);
    }

    return itemId;
}

function buildSkuMutation(itemId: string, data: SKUFields) {
    const componentMapping = rawMapping as ComponentMapping;
    const mutations: string[] = [];

    // Handle description if present
    if (data.description) {
        const componentInfo = componentMapping.description;
        const componentStructure = {
            identifier: "product-info",
            components: [
                {
                    componentId: "description",
                    paragraphCollection: {
                        paragraphs: [
                            {
                                body: {
                                    html: data.description
                                }
                            }
                        ]
                    }
                }
            ]
        };

        mutations.push(buildComponentMutation(
            'description',
            { componentId: 'product-info', type: 'piece' },
            JSON.stringify(componentStructure).replace(/"([^"]+)":/g, '$1:'),
            itemId
        ));
    }

    // Handle dimensions
    if (data.dim && Object.keys(data.dim).length > 0) {
        const dimInfo = componentMapping.dim;
        const dimComponents = [];

        Object.entries(data.dim).forEach(([key, value]) => {
            if (value && dimInfo.components[key]) {
                dimComponents.push({
                    componentId: dimInfo.components[key].componentId,
                    numeric: {
                        number: value.number,
                        unit: value.unit
                    }
                });
            }
        });

        if (dimComponents.length > 0) {
            mutations.push(buildComponentMutation(
                'dim',
                { componentId: 'dim', type: 'componentMultipleChoice' },
                JSON.stringify(dimComponents).replace(/"([^"]+)":/g, '$1:'),
                itemId
            ));
        }
    }

    // Handle product attributes
    if (data.produktattributer?.attributer?.sections) {
        const attrInfo = componentMapping.produktattributer;
        const sections = data.produktattributer.attributer.sections
            .filter(section => section.title && section.properties.length > 0);

        if (sections.length > 0) {
            const attributeComponent = [{
                componentId: 'attributer',
                propertiesTable: {
                    sections: sections
                }
            }];

            mutations.push(buildComponentMutation(
                'produktattributer',
                { componentId: 'produktattributer', type: 'componentMultipleChoice' },
                JSON.stringify(attributeComponent).replace(/"([^"]+)":/g, '$1:'),
                itemId
            ));
        }
    }

    return `
        mutation {
            ${mutations.join('\n')}
        }
    `;
}

function buildComponentMutation(
    fieldName: string,
    componentInfo: { componentId: string; type: string },
    componentStructureString: string,
    itemId: string
): string {
    return `
        ${fieldName}: updateComponent(
            itemId: "${itemId}"
            language: "en"
            component: {
                componentId: "${componentInfo.componentId}"
                ${componentInfo.type === 'piece' ? 'piece' : 'componentMultipleChoice'}: ${componentStructureString}
            }
        ) {
            ... on UpdatedComponent {
                item {
                    id
                }
            }
            ... on BasicError {
                errorName
                message
            }
        }
    `;
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const formData = await request.formData();
        const mappedDataStr = formData.get('mappedData') as string;
        
        if (!mappedDataStr) {
            return json({ error: 'No data provided' }, { status: 400 });
        }

        const mappedData = JSON.parse(mappedDataStr) as SKUFields[];
        console.log('Parsed mapped data:', mappedData);

        const results = {
            updated: 0,
            created: 0,
            errors: [] as string[],
            skipped: 0,
            details: [] as Array<{
                sku: string;
                status: 'updated' | 'created' | 'error';
                message?: string;
            }>
        };

        // Process each row
        for (const row of mappedData) {
            console.log('Processing row for SKU:', row.sku);
            
            if (!row.sku) {
                results.errors.push('Row missing SKU value');
                results.details.push({
                    sku: 'unknown',
                    status: 'error',
                    message: 'Missing SKU value'
                });
                continue;
            }

            try {
                // Get ItemId for the SKU
                const itemId = await getItemIdFromSku(row.sku);
                console.log(`Found ItemId ${itemId} for SKU ${row.sku}`);

                // Build mutation using the ItemId
                const mutation = buildSkuMutation(itemId, row);
                console.log('Generated mutation:', mutation);
                
                // Execute mutation
                const mutationResult = await client.nextPimApi(mutation);
                console.log('Mutation result:', mutationResult);
                
                // Check for errors in the mutation result
                const hasErrors = Object.values(mutationResult).some(
                    (result: any) => result.__typename === 'BasicError'
                );

                if (hasErrors) {
                    const errorMessages = Object.values(mutationResult)
                        .filter((result: any) => result.__typename === 'BasicError')
                        .map((error: any) => error.message)
                        .join(', ');

                    throw new Error(errorMessages);
                }

                // Update success counters and details
                results.updated++;
                results.details.push({
                    sku: row.sku,
                    status: 'updated',
                    message: 'Successfully updated'
                });
                
            } catch (error) {
                console.error(`Error processing SKU ${row.sku}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push(`Error processing SKU ${row.sku}: ${errorMessage}`);
                results.details.push({
                    sku: row.sku,
                    status: 'error',
                    message: errorMessage
                });
            }
        }

        console.log('Final results:', results);
        return json(results);
    } catch (error) {
        console.error('Processing error:', error);
        return json({ 
            error: 'Failed to process data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}; 