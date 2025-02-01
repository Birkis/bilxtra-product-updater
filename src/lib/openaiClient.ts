import OpenAI from 'openai';
import { OPENAI_API_KEY } from '$env/static/private';

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
}

export const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
}); 