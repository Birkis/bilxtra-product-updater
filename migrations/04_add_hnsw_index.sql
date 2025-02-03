-- Add HNSW index for testing
CREATE INDEX IF NOT EXISTS car_details_vector_embedding_hnsw_idx 
ON car_details_vector 
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,              -- Default number of connections per layer
    ef_construction = 64 -- Size of dynamic candidate list (build time parameter)
);

-- Add a function to test HNSW search
CREATE OR REPLACE FUNCTION match_car_details_hnsw(
    query_embedding vector(1536),
    car_make text,
    car_model text,
    car_production_year integer,
    match_threshold float DEFAULT 0.0,
    match_count int DEFAULT 50
)
RETURNS TABLE (
    car_details_vector_id int,
    car_data_id int,
    car_details text,
    similarity float,
    -- Product IDs
    front_rack_id int,
    front_rack_name text,
    rear_rack_id int,
    rear_rack_name text,
    bar_id int,
    bar_name text,
    foot_id int,
    foot_name text,
    kit_id int,
    kit_name text,
    -- Metadata
    car_type text,
    number_of_doors text,
    car_variation text,
    compatible_bar_for_caprock boolean,
    compatible_rack_for_tent boolean,
    compatible_roof_for_tent boolean,
    foot_attachment text,
    rack_product text,
    -- Scores
    product_score float,
    combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- This function is identical to match_car_details_optimized but will use the HNSW index
    RETURN QUERY
    WITH base_matches AS (
        SELECT c.*
        FROM car_data c
        WHERE 
            (car_make IS NULL OR c.make ILIKE car_make) AND
            (car_model IS NULL OR c.model ILIKE format('%%%s%%', car_model)) AND
            (car_production_year IS NULL OR 
                (car_production_year >= c.car_start_year AND 
                (c.car_stop_year IS NULL OR car_production_year <= c.car_stop_year)))
    ),
    vector_matches AS (
        SELECT 
            cd.id as car_details_vector_id,
            cd.car_data_id,
            cd.car_description as car_details,
            1 - (cd.embedding <-> query_embedding) as similarity,
            b.*
        FROM car_details_vector cd
        JOIN base_matches b ON cd.car_data_id = b.id
        WHERE 1 - (cd.embedding <-> query_embedding) > match_threshold
        ORDER BY cd.embedding <-> query_embedding
        LIMIT match_count
    )
    SELECT
        vm.car_details_vector_id,
        vm.car_data_id,
        vm.car_details,
        vm.similarity,
        vm.front_rack_id,
        vm.front_rack_name,
        vm.rear_rack_id,
        vm.rear_rack_name,
        vm.bar_id,
        vm.bar_name,
        vm.foot_id,
        vm.foot_name,
        vm.kit_id,
        vm.kit_name,
        vm.car_type,
        vm.number_of_doors,
        vm.car_variation,
        vm.compatible_bar_for_caprock,
        vm.compatible_rack_for_tent,
        vm.compatible_roof_for_tent,
        vm.foot_attachment,
        vm.rack_product,
        (
            CASE WHEN vm.front_rack_id IS NOT NULL THEN 2.0 ELSE 0.0 END +
            CASE WHEN vm.rear_rack_id IS NOT NULL THEN 2.0 ELSE 0.0 END +
            CASE WHEN vm.bar_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
            CASE WHEN vm.foot_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
            CASE WHEN vm.kit_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
            CASE WHEN vm.compatible_bar_for_caprock THEN 0.2 ELSE 0.0 END +
            CASE WHEN vm.compatible_rack_for_tent THEN 0.2 ELSE 0.0 END +
            CASE WHEN vm.compatible_roof_for_tent THEN 0.2 ELSE 0.0 END
        )::float / 8.0 AS product_score,
        (vm.similarity * 0.6 + 
         (CASE WHEN vm.front_rack_id IS NOT NULL THEN 2.0 ELSE 0.0 END +
          CASE WHEN vm.rear_rack_id IS NOT NULL THEN 2.0 ELSE 0.0 END +
          CASE WHEN vm.bar_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
          CASE WHEN vm.foot_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
          CASE WHEN vm.kit_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
          CASE WHEN vm.compatible_bar_for_caprock THEN 0.2 ELSE 0.0 END +
          CASE WHEN vm.compatible_rack_for_tent THEN 0.2 ELSE 0.0 END +
          CASE WHEN vm.compatible_roof_for_tent THEN 0.2 ELSE 0.0 END
         )::float / 8.0 * 0.4
        ) AS combined_score
    FROM vector_matches vm
    ORDER BY combined_score DESC;
END;
$$;

-- Add rollback commands in case we need to remove the index
COMMENT ON FUNCTION match_car_details_hnsw IS 'Test function using HNSW index. Can be safely dropped if needed.';
COMMENT ON INDEX car_details_vector_embedding_hnsw_idx IS 'Test HNSW index. Can be safely dropped if needed.'; 