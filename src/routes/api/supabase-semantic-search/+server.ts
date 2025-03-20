import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from '$env/static/private';
import { OPENAI_API_KEY } from '$env/static/private';

// Supabase client setup
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_SERVICE_ROLE;
const openaiKey = OPENAI_API_KEY;

interface SearchResult {
  id: string;
  name: string;
  item_id: string;
  sku: string;
  price: number;
  price_ex_vat: number;
  image_url: string;
  url: string;
  stock: number;
  total_stock: number;
  attributes: Record<string, any>;
  similarity: number;
}

/**
 * Generate embedding for search query using OpenAI API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
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

export const GET: RequestHandler = async ({ url }) => {
  const searchTerm = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);
  const matchThreshold = parseFloat(url.searchParams.get('threshold') || '0.7');
  
  if (!searchTerm) {
    return new Response(JSON.stringify({ error: 'Search term is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    return new Response(JSON.stringify({ error: 'API configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Start timer for performance benchmarking
    const startTime = performance.now();
    
    // Generate embedding for the search query
    const embedding = await generateEmbedding(searchTerm);
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Perform vector similarity search
    const { data, error } = await supabase.rpc('match_products', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: limit
    });
      
    if (error) throw error;
    
    const endTime = performance.now();
    const queryTime = (endTime - startTime).toFixed(2);
    
    return new Response(JSON.stringify({
      results: data as SearchResult[],
      meta: {
        count: data.length,
        query_time_ms: queryTime,
        search_term: searchTerm
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error',
      searchTerm
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 