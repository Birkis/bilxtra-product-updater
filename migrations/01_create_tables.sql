-- Drop existing tables if they exist
DROP TABLE IF EXISTS car_details_vector;
DROP TABLE IF EXISTS car_data;

-- Create the main car_data table
CREATE TABLE IF NOT EXISTS car_data (
    id SERIAL PRIMARY KEY,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    car_start_year INTEGER,
    car_stop_year INTEGER,
    car_type TEXT,
    number_of_doors TEXT,
    car_variation TEXT,
    car_description TEXT,
    -- Product IDs
    front_rack_id INTEGER,
    front_rack_name TEXT,
    rear_rack_id INTEGER,
    rear_rack_name TEXT,
    bar_id INTEGER,
    bar_name TEXT,
    foot_id INTEGER,
    foot_name TEXT,
    kit_id INTEGER,  -- RackSolution Kit ID
    kit_name TEXT,   -- RackSolution Kit Name
    -- Additional metadata
    compatible_bar_for_caprock BOOLEAN,
    compatible_rack_for_tent BOOLEAN,
    compatible_roof_for_tent BOOLEAN,
    compatible_roof_for_tent_lov_id TEXT,
    data_product_color TEXT,
    data_product_webtitle TEXT,
    foot_attachment TEXT,
    rack_product TEXT,
    rooftop_tent_compatible BOOLEAN,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create vector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the vector table for embeddings
CREATE TABLE IF NOT EXISTS car_details_vector (
    id SERIAL PRIMARY KEY,
    car_data_id INTEGER REFERENCES car_data(id) ON DELETE CASCADE,
    car_description TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_car_data_make_model ON car_data(make, model);
CREATE INDEX IF NOT EXISTS idx_car_data_year_range ON car_data(car_start_year, car_stop_year);
CREATE INDEX IF NOT EXISTS idx_car_details_vector_car_data_id ON car_details_vector(car_data_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for timestamp updates
CREATE TRIGGER update_car_data_updated_at
    BEFORE UPDATE ON car_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_car_details_vector_updated_at
    BEFORE UPDATE ON car_details_vector
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 