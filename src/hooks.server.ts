import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    // Disable CSRF for API routes
    if (event.url.pathname.startsWith('/api/')) {
        event.request.headers.set('csrf-token', 'disabled');
    }

    const response = await resolve(event);
    return response;
}; 