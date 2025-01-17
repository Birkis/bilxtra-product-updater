-- Create timestamp trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create cars table
CREATE TABLE IF NOT EXISTS cars (
    id SERIAL PRIMARY KEY,
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_start_year INT,
    car_stop_year INT,
    car_type TEXT,
    number_of_doors INT,
    car_full_name TEXT,
    car_variation TEXT,
    chassis_code TEXT,
    generation TEXT,
    market_availability TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create solutions table
CREATE TABLE IF NOT EXISTS solutions (
    id SERIAL PRIMARY KEY,
    solution_id TEXT UNIQUE,
    solution_type TEXT,
    solution_start_year INT,
    solution_stop_year INT,
    solution_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_id TEXT UNIQUE,
    product_name TEXT,
    product_type TEXT,
    status_erp TEXT,
    webtitle1 TEXT,
    color TEXT,
    dimensions TEXT,
    data_product_image JSONB,
    k_type_ids JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create solution_products link table
CREATE TABLE IF NOT EXISTS solution_products (
    id SERIAL PRIMARY KEY,
    solution_id INT NOT NULL REFERENCES solutions(id),
    product_id INT NOT NULL REFERENCES products(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create car_solutions link table
CREATE TABLE IF NOT EXISTS car_solutions (
    id SERIAL PRIMARY KEY,
    car_id INT NOT NULL REFERENCES cars(id),
    solution_id INT NOT NULL REFERENCES solutions(id),
    fit_tips JSONB,
    engineering_comment TEXT,
    fit_status TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create staging table for CSV import
CREATE TABLE IF NOT EXISTS staging_csv (
    id SERIAL PRIMARY KEY,
    car_make TEXT,
    car_model TEXT,
    car_start_year TEXT,
    car_stop_year TEXT,
    raw_data JSONB,
    imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add triggers for timestamp updates
CREATE TRIGGER set_timestamp_cars
    BEFORE UPDATE ON cars
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_solutions
    BEFORE UPDATE ON solutions
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_products
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_solution_products
    BEFORE UPDATE ON solution_products
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_car_solutions
    BEFORE UPDATE ON car_solutions
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp(); 