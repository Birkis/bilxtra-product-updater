-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_car_fits_updated_at ON car_fits;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop existing table (if you want to start fresh)
DROP TABLE IF EXISTS car_fits;

-- Create the main car_fits table to match the new CSV structure
CREATE TABLE IF NOT EXISTS car_fits (
    id BIGSERIAL PRIMARY KEY,
    "Car Make" TEXT NOT NULL,
    "Car Model" TEXT NOT NULL,
    "Car Start Year" INTEGER,
    "Car Stop Year" INTEGER,
    "K-MOD" TEXT,
    "K-TYPE" JSONB,
    "Car Type" TEXT,
    "Number of Doors" TEXT,
    "Car Variation" TEXT,
    "Solution type" TEXT,
    "Complete Front Rack ID" TEXT,
    "Complete Front Rack Name" TEXT,
    "Complete Rear Rack ID" TEXT,
    "Complete Rear Rack Name" TEXT,
    "Bar ID" TEXT,
    "Bar Name" TEXT,
    "Foot ID" TEXT,
    "Foot Name" TEXT,
    "RackSolution Kit ID" TEXT,
    "RackSolution Kit Name" TEXT,
    "CarMiscellaneous" TEXT,
    "ChassisCode" TEXT,
    "CompatibleBarForCaprock" BOOLEAN,
    "CompatibleRackForTent" BOOLEAN,
    "CompatibleRoofForTent" BOOLEAN,
    "CompatibleRoofForTent LOV ID" TEXT,
    "Data product Color Specification" TEXT,
    "Data product Webtitle1" TEXT,
    "FootAttachment" TEXT,
    "RackProduct" TEXT,
    "Rooftop Tent Compatible" BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE("Car Make", "Car Model", "Car Variation", "Car Start Year", "Complete Front Rack ID", "Bar ID")
);

-- Create an index to improve query performance
CREATE INDEX IF NOT EXISTS car_fits_lookup_idx 
ON car_fits ("Car Make", "Car Model", "Car Variation");

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_car_fits_updated_at
    BEFORE UPDATE ON car_fits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 