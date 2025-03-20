import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from '$env/static/private';

// Supabase client setup
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_SERVICE_ROLE;

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
}

export const GET: RequestHandler = async ({ url }) => {
  const searchTerm = url.searchParams.get('q');
  
  if (!searchTerm) {
    return new Response(JSON.stringify({ error: 'Search term is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Database configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Start timer for performance benchmarking
    const startTime = performance.now();
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Basic text search
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .textSearch('name', searchTerm, { 
        type: 'websearch',
        config: 'english' 
      })
      .filter('total_stock', 'gte', 3)
      .limit(20);
      
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