-- Drop existing function first
DROP FUNCTION IF EXISTS match_car_details(vector(1536), float, int, integer);

-- Function: match_car_details
-- Description: This function retrieves car details based on a similarity search
-- using a vector embedding and allows filtering by production year

CREATE OR REPLACE FUNCTION match_car_details(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  car_production_year integer
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
  RETURN QUERY
  WITH scored_matches AS (
    SELECT
      cd.id AS car_details_vector_id,
      cd.car_data_id,
      cd.car_description AS car_details,
      1 - (cd.embedding <-> query_embedding) AS similarity,
      -- Product IDs and names
      c.front_rack_id,
      c.front_rack_name,
      c.rear_rack_id,
      c.rear_rack_name,
      c.bar_id,
      c.bar_name,
      c.foot_id,
      c.foot_name,
      c.kit_id,
      c.kit_name,
      -- Metadata
      c.car_type,
      c.number_of_doors,
      c.car_variation,
      c.compatible_bar_for_caprock,
      c.compatible_rack_for_tent,
      c.compatible_roof_for_tent,
      c.foot_attachment,
      c.rack_product,
      -- Calculate product score with weighted components
      (
        -- Complete solutions (front/rear racks) get highest weight
        CASE WHEN c.front_rack_id IS NOT NULL THEN 2.0 ELSE 0.0 END +
        CASE WHEN c.rear_rack_id IS NOT NULL THEN 2.0 ELSE 0.0 END +
        -- Individual components get medium weight
        CASE WHEN c.bar_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
        CASE WHEN c.foot_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
        CASE WHEN c.kit_id IS NOT NULL THEN 1.0 ELSE 0.0 END +
        -- Compatibility features get small bonus
        CASE WHEN c.compatible_bar_for_caprock THEN 0.2 ELSE 0.0 END +
        CASE WHEN c.compatible_rack_for_tent THEN 0.2 ELSE 0.0 END +
        CASE WHEN c.compatible_roof_for_tent THEN 0.2 ELSE 0.0 END
      )::float / 8.0 AS product_score
    FROM 
      car_details_vector cd
    JOIN 
      car_data c ON cd.car_data_id = c.id
    WHERE 
      car_production_year IS NULL OR
      (
        car_production_year >= c.car_start_year AND 
        (c.car_stop_year IS NULL OR car_production_year <= c.car_stop_year)
      )
  )
  SELECT
    sm.car_details_vector_id,
    sm.car_data_id,
    sm.car_details,
    sm.similarity,
    sm.front_rack_id,
    sm.front_rack_name,
    sm.rear_rack_id,
    sm.rear_rack_name,
    sm.bar_id,
    sm.bar_name,
    sm.foot_id,
    sm.foot_name,
    sm.kit_id,
    sm.kit_name,
    sm.car_type,
    sm.number_of_doors,
    sm.car_variation,
    sm.compatible_bar_for_caprock,
    sm.compatible_rack_for_tent,
    sm.compatible_roof_for_tent,
    sm.foot_attachment,
    sm.rack_product,
    sm.product_score,
    -- Combined score weights similarity and product completeness
    (sm.similarity * 0.6 + sm.product_score * 0.4) AS combined_score
  FROM scored_matches sm
  ORDER BY
    combined_score DESC,
    product_score DESC,
    similarity DESC
  LIMIT LEAST(match_count, 200);
END;
$$; 