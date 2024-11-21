import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { client } from '$lib/crystallizeClient';
import { json } from '@sveltejs/kit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ComponentMapping, ProductData } from '$lib/types/componentMapping';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Construct the absolute path to the YAML file
const yamlPath = join(__dirname, '../../../lib/componentMapping.yaml');

// Replace direct fs read
// const mapping = fs.readFileSync('./src/lib/componentMapping.yaml', 'utf8');

// With dynamic import
import componentMapping from '$lib/componentMapping.yaml';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { itemId, productData } = await request.json();

        console.log('Received data: ', { itemId, productData });

        // Load the component mapping from the YAML file
        const componentMapping = yaml.load(componentMapping) as ComponentMapping;

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

            // Handle dimensional data dynamically
            const dimInfo = componentMapping.dim;
            if (dimInfo && dimInfo.components) {
                const dimComponents = [];
                
                // Iterate over all possible dimension components from the mapping
                Object.entries(dimInfo.components).forEach(([key, component]) => {
                    // Check if we have data for this dimension
                    const dimensionData = productData[key as keyof ProductData];
                    if (dimensionData && 'number' in dimensionData && 'unit' in dimensionData) {
                        dimComponents.push({
                            componentId: component.componentId,
                            numeric: {
                                number: dimensionData.number,
                                unit: dimensionData.unit
                            }
                        });
                    }
                });

                // Only create mutation if we have components to update
                if (dimComponents.length > 0) {
                    const componentStructureString = JSON.stringify(dimComponents, null, 2)
                        .replace(/"([^"]+)":/g, '$1:')
                        .replace(/"/g, '"');

                    mutations.push(buildComponentMutation('dim', dimInfo, componentStructureString, itemId));
                }
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
