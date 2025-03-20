import type { PageLoad } from './$types';
import type { SearchPageData } from '$lib/types/search';

export const load = (({ data }) => {
    return data;
}) satisfies PageLoad<SearchPageData>;