import { discoveryApi } from '$lib/crystallizeClient';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define types for Crystallize response
interface ProductImage {
  url: string;
  key: string;
}

interface StockLocation {
  stock: number;
}

interface ProductVariant {
  sku: string;
  name: string;
  firstImage: ProductImage;
  defaultPrice: number;
  defaultStock: number;
  stockLocations: Record<string, StockLocation>;
}

interface ProductComponent {
  id: string;
  name: string;
  type: string;
  content: any;
}

interface Product {
  name: string;
  itemId: string;
  shortcuts: string[];
  defaultVariant: ProductVariant;
  components: ProductComponent[];
}

interface CrystallizeResponse {
  browse: {
    generiskProdukt: {
      hits: Product[];
    };
  };
}

// Query for fetching products from Crystallize
const PRODUCT_QUERY = `
  query GET_SAMPLE_PRODUCTS($limit: Int!) {
    browse {
      generiskProdukt(
        pagination: { limit: $limit }
        sorting: { name: asc }
      ) {
        hits {
          name
          itemId
          shortcuts
          defaultVariant {
            sku
            name
            firstImage {
              url
              key
            }
            defaultPrice
            defaultStock
            stockLocations
          }
          components {
            id
            name
            type
            content
          }
        }
      }
    }
  }
`;

async function migrateProducts(): Promise<void> {
  try {
    // Fetch sample products (e.g., 200)
    console.log('Fetching products from GraphQL API...');
    const data = await discoveryApi<CrystallizeResponse>(PRODUCT_QUERY, { limit: 200 });
    const products = data.browse.generiskProdukt.hits;
    
    console.log(`Retrieved ${products.length} products from Crystallize`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const product of products) {
      try {
        // Get the first valid shortcut or use a default path
        const validShortcut = product.shortcuts?.find(s => s.startsWith('/categories')) || '/ukategorisert';
        const cleanPath = validShortcut.replace(/^\/categories/, '');
        
        // Calculate total stock across locations
        const totalStock = Object.values(product.defaultVariant?.stockLocations || {})
          .reduce((sum, location) => sum + (location.stock || 0), 0);
        
        // Extract attributes from components
        const attributes: Record<string, any> = {};
        for (const component of (product.components || [])) {
          if (component.type && component.content) {
            attributes[component.type] = component.content;
          }
        }
        
        const priceExVat = product.defaultVariant?.defaultPrice || 0;
        const priceWithVat = Number((priceExVat * 1.25).toFixed(2));
        
        // Insert into Supabase
        const { error } = await supabase.from('products').insert({
          item_id: product.itemId,
          name: product.name,
          sku: product.defaultVariant?.sku,
          price: priceWithVat,
          price_ex_vat: priceExVat,
          image_url: product.defaultVariant?.firstImage?.url,
          stock: product.defaultVariant?.defaultStock || 0,
          total_stock: totalStock,
          url: `https://bilxtra.no${cleanPath}`,
          attributes
        });
        
        if (error) {
          console.error(`Error inserting ${product.name}:`, error);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`Processed ${successCount} products...`);
          }
        }
      } catch (itemError) {
        console.error(`Error processing product ${product.name}:`, itemError);
        errorCount++;
      }
    }
    
    console.log(`Migration complete: ${successCount} products migrated successfully, ${errorCount} errors`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateProducts(); 