import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { openai } from '$lib/openaiClient';
import { OPENAI_ASSISTANT_ID_GPT4 } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { message, type } = await request.json();
        
        // Create a new thread
        const thread = await openai.beta.threads.create();
        
        // Prepare the message content based on type
        let messageContent;
        if (type === 'image') {
            // Convert base64 to buffer
            const base64Data = message.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Create a proper File object
            const file = new File([buffer], 'image.png', {
                type: 'image/png',
                lastModified: Date.now()
            });
            
            // Upload the file to OpenAI
            const uploadedFile = await openai.files.create({
                file,
                purpose: 'assistants'
            });
            
            messageContent = {
                role: "user" as const,
                content: [
                    {
                        type: "image_file",
                        image_file: {
                            file_id: uploadedFile.id
                        }
                    }
                ]
            };
        } else {
            messageContent = {
                role: "user" as const,
                content: message
            };
        }
        
        // Add the message to the thread
        await openai.beta.threads.messages.create(
            thread.id,
            messageContent
        );
        
        // Run the assistant
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: OPENAI_ASSISTANT_ID_GPT4,
        });
        
        // Wait for completion with timeout
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        while (runStatus.status !== "completed" && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            
            if (runStatus.status === "failed") {
                throw new Error("Assistant run failed");
            }
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            throw new Error("Request timed out");
        }
        
        // Get the assistant's response
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantMessage = messages.data[0].content[0];
        
        // Handle different content types in the response
        let response;
        if ('text' in assistantMessage) {
            response = assistantMessage.text.value;
        } else {
            response = assistantMessage;
        }
        
        return json({ response });
        
    } catch (error) {
        console.error('Error in chat endpoint:', error);
        return json({ 
            error: error instanceof Error ? error.message : 'Failed to process chat request' 
        }, { status: 500 });
    }
}; 