import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SKUFields } from '$lib/types/sku';
import type { ComponentMapping } from '$lib/types/componentMapping';
import { client } from '$lib/crystallizeClient';
import rawMapping from '$lib/componentMapping.yaml';

function buildSkuMutation(sku: string, data: SKUFields) {
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
            sku
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
                sku
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
                sku
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
    sku: string
): string {
    return `
        ${fieldName}: updateComponent(
            itemId: "${sku}"
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

export const POST: RequestHandler = async ({ request, fetch }) => {
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
                // Build mutation for this SKU
                console.log('Building mutation for SKU:', row.sku);
                console.log('Row data:', row);
                
                const mutation = buildSkuMutation(row.sku, row);
                console.log('Generated mutation:', mutation);
                
                // Execute mutation
                console.log('Executing mutation for SKU:', row.sku);
                const mutationResult = await client.nextPimApi(mutation);
                console.log('Mutation result:', mutationResult);
                
                // Check for errors in the mutation result
                const hasErrors = Object.values(mutationResult).some(
                    result => result.__typename === 'BasicError'
                );

                if (hasErrors) {
                    const errorMessages = Object.values(mutationResult)
                        .filter(result => result.__typename === 'BasicError')
                        .map(error => error.message)
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