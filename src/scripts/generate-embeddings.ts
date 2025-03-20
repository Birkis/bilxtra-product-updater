import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!OPENAI_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BATCH_SIZE = 10; // Process in batches to avoid rate limits

interface Product {
  id: string;
  name: string;
  description: string | null;
  attributes: Record<string, any>;
}

/**
 * Generate embedding for text using OpenAI API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002'
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${result.error?.message || 'Unknown error'}`);
    }
    
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Get products without embeddings
 */
async function getProductsWithoutEmbeddings(limit: number = 1000): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, attributes')
    .is('description_embedding', null)
    .limit(limit);
    
  if (error) {
    throw error;
  }
  
  return data as Product[];
}

/**
 * Update product with embedding
 */
async function updateProductEmbedding(id: string, embedding: number[]): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ description_embedding: embedding })
    .eq('id', id);
    
  if (error) {
    throw error;
  }
}

/**
 * Process products in batches
 */
async function processProductBatch(products: Product[]): Promise<void> {
  for (const product of products) {
    try {
      // Combine name, description, and any text from attributes for better embeddings
      const textAttributes = Object.entries(product.attributes || {})
        .filter(([_, value]) => typeof value === 'string')
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      const textToEmbed = [
        `Product Name: ${product.name}`,
        product.description ? `Description: ${product.description}` : '',
        textAttributes
      ].filter(Boolean).join('\n\n');
      
      console.log(`Generating embedding for product: ${product.name}`);
      const embedding = await generateEmbedding(textToEmbed);
      await updateProductEmbedding(product.id, embedding);
      console.log(`Updated embedding for product: ${product.name}`);
      
      // Sleep to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing product ${product.name}:`, error);
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    const products = await getProductsWithoutEmbeddings();
    console.log(`Found ${products.length} products without embeddings`);
    
    // Process in batches
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(products.length / BATCH_SIZE)}`);
      await processProductBatch(batch);
    }
    
    console.log('Finished generating embeddings');
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main(); 