# Crystallize GraphQL API Learnings

## Discovery API
- The Discovery API provides powerful search capabilities across product information
- Search can be performed on product descriptions using the `productInfo_description_body_plainText` filter
- Results include:
  - `itemId`: Unique identifier for the product
  - `name`: Product name
  - `shortcuts`: Array of category paths/URLs for the product
- Use the centralized `discoveryApi` client from `crystallizeClient.ts` for all Discovery API communication

## Query Structure
```graphql
query FIND_PRODUCTS($search_term: String) {
  search(filters: {
    productInfo_description_body_plainText: {
      contains: $search_term
    }
  }) {
    hits {
      shortcuts
      name
      itemId
    }
  }
}
```

## URL Construction
- Product URLs are constructed by:
  1. Taking the first shortcut path that starts with '/categories'
  2. Removing the '/categories' prefix using regex: `path.replace(/^\/categories/, '')`
  3. Prepending 'https://bilxtra.no' to the cleaned path
- Example transformation:
  - Original path: `/categories/ukategorisert/thule-cl-10-030`
  - Cleaned path: `/ukategorisert/thule-cl-10-030`
  - Final URL: `https://bilxtra.no/ukategorisert/thule-cl-10-030`

## Project Configuration
- YAML files are used for configuration in the project
- Vite requires the `@rollup/plugin-yaml` package to handle YAML files during build
- Configuration in `vite.config.ts`:
  ```typescript
  import yaml from '@rollup/plugin-yaml';
  
  export default defineConfig({
    plugins: [sveltekit(), yaml()]
  });
  ``` 