import type { RequestHandler } from '@sveltejs/kit';

interface FeedConfig {
    id: string;
    name: string;
    partner: string;
    mapping: any; // A JSON object defining the feed mapping
}

// In-memory store for feeds (we'll replace this with Supabase later)
let feeds: FeedConfig[] = [];

// GET all feeds
export const GET: RequestHandler = async () => {
    return new Response(JSON.stringify(feeds), {
        headers: { 'Content-Type': 'application/json' }
    });
};

// POST new feed
export const POST: RequestHandler = async ({ request }) => {
    const data = await request.json();
    if (!data.name || !data.partner) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const newFeed: FeedConfig = {
        id: crypto.randomUUID(), // Using native UUID generation
        name: data.name,
        partner: data.partner,
        mapping: data.mapping || {}
    };
    feeds.push(newFeed);

    return new Response(JSON.stringify(newFeed), {
        headers: { 'Content-Type': 'application/json' }
    });
};

// DELETE feed
export const DELETE: RequestHandler = async ({ url }) => {
    const id = url.searchParams.get('id');
    if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    feeds = feeds.filter(feed => feed.id !== id);
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}; 