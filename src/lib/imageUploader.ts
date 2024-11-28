import { handleImageUpload } from '@crystallize/js-api-client';
import { client } from './crystallizeClient';
import { CRYSTALLIZE_TENANT_ID } from '$env/static/private';

export async function uploadImage(imagePath: string) {
    try {
        const image = await handleImageUpload(imagePath, client, CRYSTALLIZE_TENANT_ID);
        return { success: true, image };
    } catch (error) {
        console.error('Error uploading image:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
