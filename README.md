# Svelte E-commerce Starter

A modern e-commerce starter built with SvelteKit, featuring Crystallize integration, product discovery, and real-time chat capabilities. BRING YOUR OWN KEYS 🔑

## Features

- 🛍️ Full e-commerce functionality
- 🔍 Product discovery and search
- 💬 Real-time chat support with OpenAI integration
- 🎨 Dynamic component mapping
- 🚀 API endpoints for core operations
- ⚡ Built with SvelteKit and TypeScript

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm, pnpm, or yarn
- A Crystallize account (for e-commerce functionality)
- An OpenAI account (for AI chat features)

### Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd [your-repo-name]
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn
```

3. Create a `.env` file in the root directory with your configuration:
```env
# Crystallize API credentials
CRYSTALLIZE_TENANT_ID=your_tenant_id
CRYSTALLIZE_TENANT_IDENTIFIER=your_tenant_identifier
CRYSTALLIZE_ACCESS_TOKEN_ID=your_access_token_id
CRYSTALLIZE_ACCESS_TOKEN_SECRET=your_access_token_secret

# OpenAI configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID_GPT4=your_assistant_id
```

4. Start the development server:
```bash
npm run dev
# or
npm run dev -- --open
```

## Component Mapping Configuration

The project uses a component mapping system to match your product structure with Crystallize. You'll need to customize two files to match your product structure:

### 1. Component Mapping YAML (`src/lib/componentMapping.yaml`)

This file defines the structure of your product components. Customize it to match your Crystallize schema:

```yaml
description:
  componentId: 'your-product-info-id'
  type: 'piece'
  # ... customize structure

dim:
  componentId: 'your-dimensions-id'
  type: 'componentMultipleChoice'
  components:
    # Define your dimension components
    weight:
      componentId: 'weight-id'
      type: 'numeric'
    # ... add other dimensions
```

### 2. TypeScript Types (`src/lib/types/componentMapping.ts`)

Update the type definitions to match your YAML structure:

```typescript
export interface ComponentMapping {
    description: DescriptionComponent;
    dim: DimensionsComponent;
    # Add your custom components
}

export interface ProductData {
    description?: string;
    weight?: {
        number: number;
        unit: string;
    };
    # Add your custom product data types
}
```

## Project Structure

```
src/
├── lib/
│   ├── crystallizeClient.ts    # Crystallize API client
│   ├── componentMapping.yaml   # Component mapping configuration
│   └── types/                 # TypeScript type definitions
├── routes/
│   ├── api/                   # API endpoints
│   │   ├── chat/             # Chat functionality
│   │   ├── discovery/        # Product discovery
│   │   └── update-product/   # Product management
│   └── products/             # Product pages
```

## API Endpoints

- `/api/chat` - AI-powered chat functionality
- `/api/discovery` - Product search and discovery
- `/api/core-api-mutate` - Core API mutations
- `/api/update-product` - Product management

## Building for Production

To create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deployment

This project can be deployed to any platform that supports SvelteKit applications. You may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Security Considerations

- Never commit your `.env` file
- Implement proper rate limiting for API endpoints
- Set up proper CORS policies
- Validate all input data
- Use environment-specific API keys

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Support

For questions and support, please [open an issue](your-repo-url/issues) on GitHub.
