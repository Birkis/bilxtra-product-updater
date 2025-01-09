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
    try {
        const requestBody = {
            query,
            variables,
        };

        console.log('Discovery API request:', {
            url: `https://api.crystallize.com/${CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`,
            headers: {
                'Content-Type': 'application/json',
                'X-Crystallize-Access-Token-Id': 'present',
                'X-Crystallize-Access-Token-Secret': 'present'
            },
            body: requestBody
        });

        const response = await fetch(`https://api.crystallize.com/${CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Crystallize-Access-Token-Id': CRYSTALLIZE_ACCESS_TOKEN_ID,
                'X-Crystallize-Access-Token-Secret': CRYSTALLIZE_ACCESS_TOKEN_SECRET
            },
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log('Raw response:', responseText);

        if (!response.ok) {
            console.error('Discovery API HTTP error:', {
                status: response.status,
                statusText: response.statusText,
                body: responseText
            });
            throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse response as JSON:', e);
            throw new Error(`Invalid JSON response from API: ${responseText}`);
        }

        console.log('Discovery API response:', result);
        
        if (result.errors) {
            console.error('Discovery API GraphQL errors:', result.errors);
            const errorMessage = result.errors.map(e => e.message).join(', ');
            throw new Error(`GraphQL errors: ${errorMessage}`);
        }

        return result.data;
    } catch (error) {
        console.error('Discovery API unexpected error:', {
            error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
            query,
            variables,
            tenantId: CRYSTALLIZE_TENANT_IDENTIFIER
        });
        throw error;
    }
};


