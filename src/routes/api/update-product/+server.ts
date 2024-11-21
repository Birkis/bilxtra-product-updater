import type { RequestHandler } from './$types';
import { client } from '$lib/crystallizeClient';
import { json } from '@sveltejs/kit';

interface DimComponentsData {
    vekt?: {
        number: number;
        unit: string;
    };
    lengde?: {
        number: number;
        unit: string;
    };
}

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
                    plainText
                  }
                }
              }
              ... on RichTextContent {
                plainText
              }
              ... on SingleLineContent {
                text
              }
              ... on ComponentChoiceContent {
                selectedComponent {
                  componentId
                  content {
                    ... on SingleLineContent {
                      text
                    }
                  }
                }
              }
              ... on ContentChunkContent {
                chunks {
                  componentId
                  content {
                    ... on SingleLineContent {
                      text
                    }
                    ... on RichTextContent {
                      plainText
                    }
                    ... on NumericContent {
                      number
                      unit
                    }
                    ... on BooleanContent {
                      value
                    }
                  }
                }
              }
              ... on ItemRelationsContent {
                items {
                  id
                }
              }
              ... on GridRelationsContent {
                grids {
                  id
                }
              }
              ... on NumericContent {
                number
                unit
              }
              ... on BooleanContent {
                value
              }
            }
          }
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
        const product = await client.nextPimApi(query, {
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
        const {itemId, productData} = await request.json();

        console.log('Received data: ', { itemId: itemId, productData: productData});

        const componentMapping = {
          description: {
            componentId: 'product-info',
            type: 'piece',
            structure: (value:any) => ({
              identifier: 'product-info',
              components: [
                {
                  componentId: 'description',
                  paragraphCollection: {
                    paragraphs: [{ body: { html: value } }],
                  },
                },
              ],
            }),
          },
          dim: {
            componentId: 'dim',
            type: 'componentMultipleChoice',
            structure: (values:any) => {
              const components = [];
              if (values.vekt) {
                components.push({
                  componentId: 'vekt',
                  numeric: {
                    number: values.vekt.number,
                    unit: values.vekt.unit,
                  },
                });
              }
              if (values.lengde) {
                components.push({
                  componentId: 'lengde',
                  numeric: {
                    number: values.lengde.number,
                    unit: values.lengde.unit,
                  },
                });
              }
              return components;
            },
          },
        };
        
        

        function buildUpdateMutation(itemId:string, productData:any) {
          const mutations = [];
        
          if (productData.description) {
            const componentInfo = componentMapping['description'];
            const componentStructure = componentInfo.structure(productData.description);
        
            const componentStructureString = JSON.stringify(componentStructure, null, 2)
              .replace(/"([^"]+)":/g, '$1:')
              .replace(/"/g, '"');
        
            const componentMutation = `
              description: updateComponent(
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
            mutations.push(componentMutation);
          }
        
          const dimComponentsData: DimComponentsData = {};
          if (productData.vekt) {
            dimComponentsData.vekt = productData.vekt;
          }
          if (productData.lengde) {
            dimComponentsData.lengde = productData.lengde;
          }
        
          if (Object.keys(dimComponentsData).length > 0) {
            const componentInfo = componentMapping['dim'];
            const componentStructure = componentInfo.structure(dimComponentsData);
        
            const componentStructureString = JSON.stringify(componentStructure, null, 2)
              .replace(/"([^"]+)":/g, '$1:')
              .replace(/"/g, '"');
        
            const componentMutation = `
              dim: updateComponent(
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
            mutations.push(componentMutation);
          }
        
          const fullMutation = `mutation {
            ${mutations.join('\n')}
          }`;
          return fullMutation;
        }
        

        const mutation = buildUpdateMutation(itemId, productData);
        console.log('Generated mutation:', mutation);

        const result = await client.nextPimApi(mutation);
        return json(result.updateComponent);
    } catch (error) {
        console.error('Error updating product:', error);
        return json({ error: 'Failed to update product' }, { status: 400 });
    }
};
