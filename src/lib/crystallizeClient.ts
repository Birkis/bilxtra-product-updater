import { createClient } from '@crystallize/js-api-client';
import { env } from '$env/dynamic/private';

export const client = createClient({
    tenantIdentifier: env.CRYSTALLIZE_TENANT_IDENTIFIER,
    accessTokenId: env.CRYSTALLIZE_ACCESS_TOKEN_ID,
    accessTokenSecret: env.CRYSTALLIZE_ACCESS_TOKEN_SECRET
});
