import type { PageLoad } from './$types';

export const load = (async ({ params }) => {
    return {
        productId: params.productId
    };
}) satisfies PageLoad;