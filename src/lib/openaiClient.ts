import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

let openaiInstance: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (openaiInstance) {
        return openaiInstance;
    }

    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Validate API key format
    if (!OPENAI_API_KEY.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format. The key should start with "sk-" and should not include "Bearer"');
    }

    // Remove any potential "Bearer" prefix
    const cleanApiKey = OPENAI_API_KEY.replace(/^Bearer\s+/i, '');

    try {
        openaiInstance = new OpenAI({
            apiKey: cleanApiKey,
            baseURL: 'https://api.openai.com/v1',
            maxRetries: 3,
            timeout: 30000, // 30 seconds timeout
            defaultHeaders: {
                'User-Agent': 'bilxtra-product-updater/1.0.0'
            }
        });
        return openaiInstance;
    } catch (error) {
        console.error('Failed to initialize OpenAI client:', error);
        throw new Error('Failed to initialize OpenAI client');
    }
}

export const openai = getOpenAIClient(); 