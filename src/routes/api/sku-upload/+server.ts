import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SKUFields } from '$lib/types/sku';
import type { ComponentMapping } from '$lib/types/componentMapping';
import { componentMapping } from '$lib/componentMapping';
import { client } from '$lib/crystallizeClient';
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

async function copyRemoteImage(url: string, fileName: string, client: any) {
    const mutation = `
        mutation ADD_IMAGE($url: String!, $fileName: String) {
            copyRemoteAsset(sourceUrl: $url, targetFilename: $fileName) {
                ... on BulkTaskCopyRemoteAsset {
                    targetKey
                }
            }
        }
    `;

    const response = await client.nextPimApi(mutation, {
        url,
        fileName
    });

    return response.copyRemoteAsset?.targetKey;
}

/**
 * Builds a GraphQL mutation for updating a component in Crystallize.
 * The mutation structure follows Crystallize's PIM API requirements.
 * 
 * Example mutation structure:
 * ```graphql
 * fieldName: updateComponent(
 *   itemId: "123"
 *   language: "en"
 *   component: {
 *     componentId: "product-info",
 *     piece: { ... } or componentMultipleChoice: [ ... ]
 *   }
 * )
 * ```
 */
function buildComponentMutation(
    fieldName: string,
    componentInfo: { componentId: string; type: string },
    componentStructureString: string,
    itemId: string
): string {
    // Log the input parameters for debugging
    console.log('\nBuilding component mutation:', {
        fieldName,
        componentInfo,
        itemId
    });

    const mutation = `
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
    `.trim();

    // Log the generated mutation for debugging
    console.log('\nGenerated mutation structure:', {
        componentStructureString,
        fullMutation: mutation
    });

    return mutation;
}

interface DimComponent {
    componentId: string;
    singleLine?: {
        text: string;
    };
    numeric?: {
        number: number;
        unit: string;
    };
}

function buildSkuMutation(itemId: string, data: SKUFields) {
    console.log('\nStarting SKU mutation build for itemId:', itemId);
    
    const mutations: string[] = [];

    // Handle description and/or image
    if (data.description || (data.image && data.imageKey)) {
        console.log('\nProcessing description/image components');
        const components = [];

        // Add image component if present
        if (data.image && data.imageKey) {
            console.log('Adding image component with key:', data.imageKey);
            components.push({
                componentId: "general-product-images",
                images: [{
                    key: data.imageKey,
                    altText: `Image for ${data.name || data.sku}`
                }]
            });
        }

        // Add description component if present
        if (data.description) {
            console.log('Adding description component');
            components.push({
                componentId: "description",
                paragraphCollection: {
                    paragraphs: [{ 
                        body: { 
                            html: data.description 
                        } 
                    }]
                }
            });
        }

        const componentStructure = {
            identifier: "product-info",
            components: components
        };

        // Convert to string for GraphQL, maintaining proper structure
        const formattedStructure = JSON.stringify(componentStructure, null, 2)
            .replace(/"([^"]+)":/g, '$1:');

        console.log('\nFormatted product-info structure:', formattedStructure);

        mutations.push(buildComponentMutation(
            'contentUpdate',
            { componentId: 'product-info', type: 'piece' },
            formattedStructure,
            itemId
        ));
    }

    // Handle dimensions
    if (data.dim && Object.keys(data.dim).length > 0) {
        console.log('\nProcessing dimensions');
        const dimInfo = componentMapping.dim;
        const dimComponents: DimComponent[] = [];

        Object.entries(data.dim).forEach(([key, value]) => {
            const componentConfig = dimInfo.components[key as keyof typeof dimInfo.components];
            
            if (value && componentConfig) {
                if (componentConfig.type === 'singleLine') {
                    // Handle string dimensions (kon, gjenger, bolt-type)
                    dimComponents.push({
                        componentId: key,
                        singleLine: {
                            text: String(value)
                        }
                    });
                } else if (componentConfig.type === 'numeric' && typeof value === 'object' && 'number' in value && 'unit' in value) {
                    // Handle numeric dimensions
                    dimComponents.push({
                        componentId: key,
                        numeric: {
                            number: value.number,
                            unit: value.unit
                        }
                    });
                }
            }
        });

        if (dimComponents.length > 0) {
            // Format the dimension components for GraphQL
            const formattedDimComponents = JSON.stringify(dimComponents, null, 2)
                .replace(/"([^"]+)":/g, '$1:');

            console.log('\nFormatted dimension components:', formattedDimComponents);

            mutations.push(buildComponentMutation(
                'dim',
                { componentId: 'dim', type: 'componentMultipleChoice' },
                formattedDimComponents,
                itemId
            ));
        }
    }

    // Handle product attributes with proper type checking
    const sections = data.produktattributer?.attributer?.sections;
    if (sections && Array.isArray(sections) && sections.length > 0) {
        console.log('\nProcessing product attributes');
        const validSections = sections.filter(section => 
            section && 
            typeof section.title === 'string' && 
            Array.isArray(section.properties) && 
            section.properties.length > 0
        );

        if (validSections.length > 0) {
            const attributeComponent = [{
                componentId: 'attributer',
                propertiesTable: {
                    sections: validSections
                }
            }];

            // Format the attribute components for GraphQL
            const formattedAttributes = JSON.stringify(attributeComponent, null, 2)
                .replace(/"([^"]+)":/g, '$1:');

            console.log('\nFormatted attribute components:', formattedAttributes);

            mutations.push(buildComponentMutation(
                'produktattributer',
                { componentId: 'produktattributer', type: 'componentMultipleChoice' },
                formattedAttributes,
                itemId
            ));
        }
    }

    // Combine all mutations into a single GraphQL mutation
    const finalMutation = mutations.length > 0 ? `mutation {\n${mutations.join('\n')}\n}` : '';
    
    // Log the final combined mutation
    console.log('\nFinal combined mutation:', {
        numberOfMutations: mutations.length,
        mutation: finalMutation
    });

    return finalMutation;
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

        // Process in batches of 5
        const BATCH_SIZE = 5;
        const batches = [];
        for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
            batches.push(mappedData.slice(i, i + BATCH_SIZE));
        }

        // Process each batch
        for (const batch of batches) {
            // Add a small delay between batches to avoid rate limits
            if (batches.indexOf(batch) > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Process each row in the batch
            const batchPromises = batch.map(async (row) => {
                if (!row.sku) {
                    results.errors.push('Row missing SKU value');
                    results.details.push({
                        sku: 'unknown',
                        status: 'error',
                        message: 'Missing SKU value'
                    });
                    return;
                }

                try {
                    // Get ItemId for the SKU
                    const itemId = await getItemIdFromSku(row.sku);
                    console.log(`Found ItemId ${itemId} for SKU ${row.sku}`);

                    let updatePerformed = false;

                    // Handle name update separately using PIM API if name is present
                    if (row.name) {
                        try {
                            const nameUpdateMutation = `
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

                            await client.pimApi(nameUpdateMutation, {
                                id: itemId,
                                name: row.name
                            });
                            updatePerformed = true;
                        } catch (nameError) {
                            console.error(`Error updating name for SKU ${row.sku}:`, nameError);
                            results.errors.push(`Error updating name for SKU ${row.sku}: ${nameError.message}`);
                        }
                    }

                    // Handle image upload first if present
                    if (row.image) {
                        try {
                            const fileName = `${row.sku}-${Date.now()}`;
                            const imageKey = await copyRemoteImage(row.image, fileName, client);
                            if (imageKey) {
                                row.imageKey = imageKey;
                            }
                        } catch (imageError) {
                            console.error(`Error uploading image for SKU ${row.sku}:`, imageError);
                            results.errors.push(`Failed to upload image for SKU ${row.sku}: ${imageError.message}`);
                        }
                    }

                    // Build mutation for other fields
                    const mutation = buildSkuMutation(itemId, row);
                    const hasMutations = mutation.includes('updateComponent');

                    if (hasMutations) {
                        console.log('Generated mutation:', mutation);
                        const mutationResult = await client.nextPimApi(mutation);
                        console.log('Mutation result:', mutationResult);
                        
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
                        updatePerformed = true;
                    }

                    if (updatePerformed) {
                        results.updated++;
                        results.details.push({
                            sku: row.sku,
                            status: 'updated',
                            message: 'Successfully updated'
                        });
                    } else {
                        results.skipped++;
                        results.details.push({
                            sku: row.sku,
                            status: 'updated',
                            message: 'No updates required'
                        });
                    }
                    
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
            });

            // Wait for all SKUs in the batch to complete
            await Promise.all(batchPromises);
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