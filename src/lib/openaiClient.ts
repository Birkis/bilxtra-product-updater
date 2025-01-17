import OpenAI from 'openai';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error('VITE_OPENAI_API_KEY environment variable is not set');
}

export const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
}); 