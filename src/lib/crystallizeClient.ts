import { createClient  } from '@crystallize/js-api-client';
import { CRYSTALLIZE_TENANT_IDENTIFIER, CRYSTALLIZE_ACCESS_TOKEN_ID, CRYSTALLIZE_ACCESS_TOKEN_SECRET } from '$env/static/private';

// Base client configuration
export const client = createClient({
    tenantIdentifier: CRYSTALLIZE_TENANT_IDENTIFIER,
    accessTokenId: CRYSTALLIZE_ACCESS_TOKEN_ID,
    accessTokenSecret: CRYSTALLIZE_ACCESS_TOKEN_SECRET
});

// Export pre-configured API clients
export const nextPimApi = (query: string, variables?: Record<string, any>) => 
    client.nextPimApi(query, variables);

export const pimApi = (query: string, variables?: Record<string, any>) => 
    client.pimApi(query, variables);

// Discovery API client with consistent interface
export const discoveryApi = async <T = any>(query: string, variables?: Record<string, any>): Promise<T> => {
    const response = await fetch(`https://api.crystallize.com/${CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });
    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Discovery API error');
    }
    return result.data;
};


