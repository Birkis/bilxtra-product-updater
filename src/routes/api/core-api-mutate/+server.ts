import type { RequestHandler } from './$types';
import { client } from '$lib/crystallizeClient';
import { json } from '@sveltejs/kit';
import type { ComponentMapping, ProductData } from '$lib/types/componentMapping';

// Import the YAML file directly - no fs operations
import rawMapping from '$lib/componentMapping.yaml';

interface PropertyTableSection {
    title: string;
    properties: Array<{
        key: string;
        value: string;
    }>;
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { itemId, productData } = await request.json();

        console.log('Received data: ', { itemId, productData });

        // Parse the imported YAML content
        const componentMapping = rawMapping as ComponentMapping;

        function buildUpdateMutation(itemId: string, productData: ProductData) {
            const mutations = [];

            console.log('Building mutation for itemId:', itemId);
            console.log('Product data to process:', productData);

            // Handle description (keeping existing logic for stability)
            if (productData.description) {
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
                                            html: productData.description
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                };

                const componentStructureString = JSON.stringify(componentStructure, null, 2)
                    .replace(/"([^"]+)":/g, '$1:')
                    .replace(/"/g, '"');

                mutations.push(buildComponentMutation('description', componentInfo, componentStructureString, itemId));
            }

            // Handle dimensional data and properties table
            const dimInfo = componentMapping.dim;
            if (dimInfo && dimInfo.components) {
                const dimComponents = [];
                
                console.log('Starting dimension processing with product data:', JSON.stringify(productData, null, 2));
                
                Object.entries(dimInfo.components).forEach(([key, component]) => {
                    const dimensionData = productData.dim?.[key as keyof typeof DIMENSION_FIELDS];
                    console.log(`\nProcessing dimension ${key}:`, {
                        dimensionData,
                        type: typeof dimensionData,
                        isStringDim: ['kon', 'gjenger', 'bolt-type'].includes(key),
                        component: JSON.stringify(component, null, 2)
                    });

                    if (dimensionData) {
                        // Check the component type from YAML
                        const isStringComponent = component.type === 'singleLine';
                        console.log(`Component type check for ${key}:`, {
                            componentType: component.type,
                            isStringComponent
                        });

                        if (isStringComponent) {
                            // Handle string-based dimensions
                            const stringComponent = {
                                componentId: key,
                                singleLine: {
                                    text: String(dimensionData)
                                }
                            };
                            console.log(`Adding string component for ${key}:`, stringComponent);
                            dimComponents.push(stringComponent);
                        } else if (typeof dimensionData === 'object' && 'number' in dimensionData && 'unit' in dimensionData) {
                            // Handle numeric dimensions
                            const numericComponent = {
                                componentId: key,
                                numeric: {
                                    number: dimensionData.number,
                                    unit: dimensionData.unit
                                }
                            };
                            console.log(`Adding numeric component for ${key}:`, numericComponent);
                            dimComponents.push(numericComponent);
                        }
                    }
                });

                console.log('\nFinal dimComponents:', JSON.stringify(dimComponents, null, 2));

                // Only create mutation if we have components to update
                if (dimComponents.length > 0) {
                    const componentStructure = {
                        componentId: "dim",
                        componentMultipleChoice: dimComponents
                    };

                    console.log('\nComponent structure before stringify:', JSON.stringify(componentStructure, null, 2));

                    const componentStructureString = JSON.stringify(componentStructure, null, 2)
                        .replace(/"([^"]+)":/g, '$1:')
                        .replace(/"/g, '"');

                    console.log('\nFinal component structure string:', componentStructureString);

                    mutations.push(buildComponentMutation('dim', dimInfo, componentStructureString, itemId));
                }
            }

            // Handle 'produktattributer' component
            if (productData.produktattributer) {
                const propertiesTableContent = {
                    componentId: 'attributer',
                    propertiesTable: {
                        sections: [
                            {
                                title: 'Tekniske spesifikasjoner',
                                properties: Object.entries(productData.produktattributer).map(([key, value]) => ({
                                    key,
                                    value: String(value)
                                }))
                            }
                        ]
                    }
                };

                const componentStructure = [propertiesTableContent];

                const componentStructureString = JSON.stringify(componentStructure, null, 2)
                    .replace(/"([^"]+)":/g, '$1:')
                    .replace(/"/g, '"');

                mutations.push(
                    buildComponentMutation(
                        'produktattributer',
                        { componentId: 'produktattributer', type: 'componentMultipleChoice' },
                        componentStructureString,
                        itemId
                    )
                );
            }

            const fullMutation = `mutation {
                ${mutations.join('\n')}
            }`;
            
            console.log('Final complete mutation:', fullMutation);
            return fullMutation;
        }

        const mutation = buildUpdateMutation(itemId, productData);
        console.log('Generated mutation:', mutation);

        const result = await client.nextPimApi(mutation);
        console.log('Mutation result:', result);
        return json(result);
    } catch (error) {
        console.error('Error updating product:', error);
        return json({ error: 'Failed to update product' }, { status: 400 });
    }
};

// Helper function to build component mutation strings
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
                componentId: "${componentInfo.componentId}",
                ${componentInfo.type}: ${componentStructureString}
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
