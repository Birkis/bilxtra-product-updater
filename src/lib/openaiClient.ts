import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is NOT set');
}

// Validate API key format and clean it
const apiKey = OPENAI_API_KEY.trim();
if (!apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format. The key should start with "sk-"');
}

// Create a single instance with some reasonable defaults
export const openai = new OpenAI({
    apiKey,
    maxRetries: 3,
    timeout: 30000, // 30 seconds timeout
}); 