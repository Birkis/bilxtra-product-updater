-- Create extension for vector support (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Products table with JSONB for flexible attributes
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  price DECIMAL(10,2),
  price_ex_vat DECIMAL(10,2),
  description TEXT,
  url TEXT,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  total_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- JSONB for flexible attributes
  attributes JSONB,
  
  -- Vector embeddings for semantic search
  description_embedding VECTOR(1536)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS products_name_idx ON products USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS products_attributes_idx ON products USING GIN (attributes);

-- Function to update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the 'updated_at' timestamp
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_modified_column(); 