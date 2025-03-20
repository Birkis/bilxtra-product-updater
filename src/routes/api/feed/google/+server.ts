import type { RequestHandler } from '@sveltejs/kit';
import fetch from 'node-fetch';
import { CRYSTALLIZE_TENANT_IDENTIFIER } from '$env/static/private';

// GET endpoint to generate the Google Merchant feed in XML format
export const GET: RequestHandler = async () => {
    try {
        // Fetch products from Crystallize using the Discovery API
        const products = await fetchProducts();

        // Transform products to Google Merchant feed items
        const feedItemsXml = products.map(product => {
            const imageUrl = Array.isArray(product.variants[0]?.images) ? product.variants[0].images[0]?.url || '' : '';
            return `<item>
  <g:id>${product.itemId}</g:id>
  <g:title><![CDATA[${product.name}]]></g:title>
  <g:description><![CDATA[${product.name} - great product]]></g:description>
  <g:link>https://yourshop.com/products/${product.itemId}</g:link>
  <g:image_link>${imageUrl}</g:image_link>
  <g:condition>new</g:condition>
  <g:availability>in stock</g:availability>
  <g:price>9.99 USD</g:price>
</item>`;
        }).join('\n');

        const feedXml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"\n    xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Your Shop Google Feed</title>\n    <link>https://yourshop.com</link>\n    <description>This is a feed of products for Google Shopping</description>\n    ${feedItemsXml}\n  </channel>\n</rss>`;

        return new Response(feedXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
    } catch (err: any) {
        console.error('Error generating Google feed:', err);
        return new Response(`Failed to generate feed: ${err.message}`, { status: 500 });
    }
};

// Helper function to fetch products from Crystallize Discovery API
async function fetchProducts(): Promise<any[]> {
    const query = `
  query GET_PRODUCTS {
    browse {
      generiskProdukt(
        pagination: { limit: 100 }
      ) {
        hits {
          name
          itemId
          
          variants {
            sku
            images {
              url
            }
          }
          paginationToken
        }
        summary {
          totalHits
        }
      }
    }
  }
  `;

    const response = await fetch(`https://api.crystallize.com/${CRYSTALLIZE_TENANT_IDENTIFIER}/discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: {} })
    });

    const result = await response.json() as {
        errors?: Array<{ message: string }>,
        data: { 
            browse: { 
                generiskProdukt: {
                    hits: any[],
                    summary: { totalHits: number }
                }
            }
        }
    };

    console.log('Discovery API raw result:', result);

    if (result.errors) {
         throw new Error(result.errors[0].message);
    }
    
    return result.data.browse.generiskProdukt.hits;
} 