import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

const OPENAI_API_KEY = env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
}

export const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
}); 