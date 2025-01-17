-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the car_fits table
CREATE TABLE IF NOT EXISTS car_fits (
    id SERIAL PRIMARY KEY,
    car_make TEXT NOT NULL,
    car_model TEXT NOT NULL,
    car_start_year INT,
    car_stop_year INT,
    car_type TEXT,
    number_of_doors TEXT,
    car_variation TEXT,
    k_type JSONB,
    solution_product_id TEXT,
    complete_front_rack_id TEXT,
    bar_id TEXT,
    foot_id TEXT,
    racksolution_kit_id TEXT,
    adapter_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add named unique constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'car_fits_unique_car'
    ) THEN
        ALTER TABLE car_fits 
        ADD CONSTRAINT car_fits_unique_car 
        UNIQUE (
            car_make, 
            car_model, 
            car_variation,
            solution_product_id,
            complete_front_rack_id,
            bar_id,
            foot_id,
            racksolution_kit_id,
            adapter_id
        );
    END IF;
END $$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_timestamp_car_fits ON car_fits;
CREATE TRIGGER set_timestamp_car_fits
BEFORE UPDATE ON car_fits
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Create indexes for common queries
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_car_fits_make_model_year') THEN
        CREATE INDEX idx_car_fits_make_model_year 
        ON car_fits (car_make, car_model, car_start_year, car_stop_year);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_car_fits_k_type_gin') THEN
        CREATE INDEX idx_car_fits_k_type_gin 
        ON car_fits USING GIN (k_type);
    END IF;
END $$; 