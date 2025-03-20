-- Function to match products based on embedding similarity
-- This uses cosine similarity to find the most semantically similar products
CREATE OR REPLACE FUNCTION match_products(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  item_id TEXT,
  sku TEXT,
  price DECIMAL,
  price_ex_vat DECIMAL,
  image_url TEXT,
  url TEXT,
  stock INTEGER,
  total_stock INTEGER,
  attributes JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.item_id,
    p.sku,
    p.price,
    p.price_ex_vat,
    p.image_url,
    p.url,
    p.stock,
    p.total_stock,
    p.attributes,
    1 - (p.description_embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE 1 - (p.description_embedding <=> query_embedding) > match_threshold
    AND p.total_stock >= 3
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$; 