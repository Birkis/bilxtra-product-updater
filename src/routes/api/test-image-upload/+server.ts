import { json } from '@sveltejs/kit';
import { uploadImage } from '$lib/imageUploader';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { imageUrl } = await request.json();
        
        if (!imageUrl) {
            return json({ success: false, error: 'Image URL is required' }, { status: 400 });
        }

        const result = await uploadImage(imageUrl);
        
        if (!result.success) {
            return json({ success: false, error: result.error }, { status: 500 });
        }

        return json({ success: true, image: result.image });
    } catch (error) {
        return json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}; 