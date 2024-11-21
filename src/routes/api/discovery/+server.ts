import type { RequestHandler } from './$types';
import fetch from 'node-fetch';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({url}) => {
    const itemId = url.searchParams.get('id');

    const query = `
        query GET_PRODUCT($id: String!) { 
            browse {
            generiskProdukt(filters:{itemId:{equals:$id}}) {
            hits {
                productInfo {
                    description {
                        body (format: json)
                    }
                }
                defaultVariant {
                    sku
                    name
                }
            }
            }
        }
        }
    `;

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
          .then((response): any => response.json())
          .then((response: { data: T }) => response.data);
      }

    const data = await discoveryApiCaller(query, {id: itemId});
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
};






