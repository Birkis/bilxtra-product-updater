#!/bin/bash

# Script to benchmark and compare the performance of different search APIs

# Define search terms for testing
SEARCH_TERMS=("tershine" "turtle" "vask" "dekk" "polish" "olje" "bilpleie")

# Function to test an API endpoint with timing
test_api() {
  local endpoint=$1
  local search_term=$2
  local description=$3
  
  echo "Testing $description with query: '$search_term'"
  
  # Make the request and capture timing
  result=$(curl -s -w "\nTime: %{time_total}s\n" "http://localhost:5173$endpoint?q=$search_term")
  
  # Extract the time from the result
  time=$(echo "$result" | grep "Time:" | cut -d' ' -f2)
  
  # Count results (assuming JSON array of results)
  count=$(echo "$result" | grep -o -E '"results":\[.*\]' | grep -o "\[.*\]" | grep -o "," | wc -l)
  count=$((count + 1))
  
  # Print result
  echo "  Results: $count items"
  echo "  Time: $time"
  echo ""
  
  # Return the time value
  echo $time
}

# Run benchmarks
echo "======================================================================"
echo "                 API PERFORMANCE BENCHMARK                            "
echo "======================================================================"
echo ""

# Initialize total time variables
total_graphql=0
total_basic=0
total_semantic=0

# Test each search term
for term in "${SEARCH_TERMS[@]}"; do
  echo "======================================================================" 
  echo "Testing search term: '$term'"
  echo "======================================================================" 
  
  # GraphQL API
  time_graphql=$(test_api "/api/product-search" "$term" "GraphQL API")
  time_graphql=${time_graphql%s}
  
  # Basic Supabase API
  time_basic=$(test_api "/api/supabase-product-search" "$term" "Supabase Basic Search")
  time_basic=${time_basic%s}
  
  # Semantic Supabase API
  time_semantic=$(test_api "/api/supabase-semantic-search" "$term" "Supabase Semantic Search")
  time_semantic=${time_semantic%s}
  
  # Add to totals
  total_graphql=$(echo "$total_graphql + $time_graphql" | bc)
  total_basic=$(echo "$total_basic + $time_basic" | bc)
  total_semantic=$(echo "$total_semantic + $time_semantic" | bc)
  
  echo ""
done

# Calculate averages
avg_graphql=$(echo "scale=3; $total_graphql / ${#SEARCH_TERMS[@]}" | bc)
avg_basic=$(echo "scale=3; $total_basic / ${#SEARCH_TERMS[@]}" | bc)
avg_semantic=$(echo "scale=3; $total_semantic / ${#SEARCH_TERMS[@]}" | bc)

# Print summary
echo "======================================================================" 
echo "                          SUMMARY                                     " 
echo "======================================================================" 
echo "Average response times:"
echo "  GraphQL API:            ${avg_graphql}s"
echo "  Supabase Basic Search:  ${avg_basic}s"
echo "  Supabase Semantic:      ${avg_semantic}s"
echo ""

# Calculate improvements
basic_improvement=$(echo "scale=1; ($avg_graphql - $avg_basic) / $avg_graphql * 100" | bc)
semantic_improvement=$(echo "scale=1; ($avg_graphql - $avg_semantic) / $avg_graphql * 100" | bc)

echo "Performance improvements vs GraphQL:"
echo "  Supabase Basic Search:  ${basic_improvement}%"
echo "  Supabase Semantic:      ${semantic_improvement}%"
echo "" 