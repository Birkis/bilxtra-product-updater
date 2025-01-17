-- Create staging table for raw CSV data
CREATE TABLE IF NOT EXISTS staging_csv (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    car_make TEXT,
    car_model TEXT,
    car_start_year TEXT,
    car_stop_year TEXT,
    raw_data JSONB
);

-- Create cars table
CREATE TABLE IF NOT EXISTS cars (
    id BIGSERIAL PRIMARY KEY,
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_start_year INTEGER,
    car_stop_year INTEGER,
    car_type TEXT,
    number_of_doors TEXT,
    car_full_name TEXT,
    car_variation TEXT,
    chassis_code TEXT,
    generation TEXT,
    market_availability TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(car_make, car_model, car_variation)
);

-- Create solutions table
CREATE TABLE IF NOT EXISTS solutions (
    id BIGSERIAL PRIMARY KEY,
    solution_id TEXT UNIQUE NOT NULL,
    solution_type TEXT,
    solution_name TEXT,
    solution_start_year TEXT,
    solution_stop_year TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    product_id TEXT UNIQUE NOT NULL,
    product_name TEXT,
    product_type TEXT,
    status_erp TEXT,
    webtitle1 TEXT,
    color TEXT,
    dimensions TEXT,
    data_product_image TEXT,
    k_type_ids TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create solution_products linking table
CREATE TABLE IF NOT EXISTS solution_products (
    id BIGSERIAL PRIMARY KEY,
    solution_id BIGINT REFERENCES solutions(id),
    product_id BIGINT REFERENCES products(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(solution_id, product_id)
);

-- Create car_solutions linking table
CREATE TABLE IF NOT EXISTS car_solutions (
    id BIGSERIAL PRIMARY KEY,
    car_id BIGINT REFERENCES cars(id),
    solution_id BIGINT REFERENCES solutions(id),
    fit_tips TEXT,
    engineering_comment TEXT,
    fit_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(car_id, solution_id)
); 