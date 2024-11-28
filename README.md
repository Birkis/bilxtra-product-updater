# Svelte E-commerce Starter

A modern e-commerce starter built with SvelteKit, featuring Crystallize integration, product discovery, real-time chat capabilities, and bulk SKU management. BRING YOUR OWN KEYS 🔑

## Features

- 🛍️ Full e-commerce functionality
- 🔍 Product discovery and search
- 💬 Real-time chat support with OpenAI integration
- 🎨 Dynamic component mapping
- 🚀 API endpoints for core operations
- ⚡ Built with SvelteKit and TypeScript
- 📦 Bulk SKU upload and management
- 🤖 AI-assisted product data generation

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm, pnpm, or yarn
- A Crystallize account (for e-commerce functionality)
- An OpenAI account (for AI chat features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Birkis/bilxtra-product-updater.git
cd bilxtra-product-updater
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


## OPENAI ASSISTANT INSTRUCTIONS

You will help to find and structure product information for a given product. 

You will recieve either raw text, an image of a product description or a URL to a product page. 
From this information you will search for data that matches one or more data points from our schema. The schema must be followed rigidly, otherwise the product update will fail. 

You must always use the same units as the product input data. If weight is listed in grams you will use "g". You never convert from 178 grams to 0.178 kg if the raw data says "Weight (g): 178" you will return 178 for the weight and "g" for unit. The same applies to any other attribute.

Any attributes that are found in the text, but with no apparent related attribue should be mapped to the properties table "attributer"; a list of key/value pairs that are user defined.

The description should be product description for an e-commerce site. It should first and foremost be factual, but also aimed to sell the product. Descriptions has to be in Norwegian.

you will follow the JSON schema.


## OPENAI JSON SCHEMA

{
  "name": "item_schema",
  "strict": false,
  "schema": {
    "type": "object",
    "properties": {
      "description": {
        "type": "object",
        "description": "A textual description of the item.",
        "properties": {
          "componentId": {
            "type": "string",
            "description": "The component ID for the description.",
            "enum": [
              "product-info"
            ]
          },
          "type": {
            "type": "string",
            "description": "The type of the description component.",
            "enum": [
              "piece"
            ]
          },
          "structure": {
            "type": "object",
            "properties": {
              "identifier": {
                "type": "string",
                "description": "The identifier for the description structure.",
                "enum": [
                  "product-info"
                ]
              },
              "components": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "componentId": {
                      "type": "string",
                      "description": "The component ID for the paragraph collection.",
                      "enum": [
                        "description"
                      ]
                    },
                    "paragraphCollection": {
                      "type": "object",
                      "properties": {
                        "paragraphs": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "body": {
                                "type": "object",
                                "properties": {
                                  "html": {
                                    "type": "string",
                                    "description": "The HTML content of the paragraph."
                                  }
                                },
                                "required": [
                                  "html"
                                ]
                              }
                            },
                            "required": [
                              "body"
                            ]
                          }
                        }
                      },
                      "required": [
                        "paragraphs"
                      ]
                    }
                  },
                  "required": [
                    "componentId",
                    "paragraphCollection"
                  ]
                }
              }
            },
            "required": [
              "identifier",
              "components"
            ]
          }
        },
        "required": [
          "componentId",
          "type",
          "structure"
        ]
      },
      "dim": {
        "type": "object",
        "description": "The dimensions of the item.",
        "properties": {
          "componentId": {
            "type": "string",
            "description": "The component ID for dimensions.",
            "enum": [
              "dim"
            ]
          },
          "type": {
            "type": "string",
            "description": "The type of the dimensions component.",
            "enum": [
              "componentMultipleChoice"
            ]
          },
          "components": {
            "type": "object",
            "properties": {
              "vekt": {
                "type": "object",
                "properties": {
                  "componentId": {
                    "type": "string",
                    "enum": [
                      "vekt"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "numeric"
                    ]
                  },
                  "structure": {
                    "type": "object",
                    "properties": {
                      "number": {
                        "type": "string"
                      },
                      "unit": {
                        "type": "string"
                      }
                    },
                    "required": [
                      "number",
                      "unit"
                    ]
                  }
                },
                "required": [
                  "componentId",
                  "type",
                  "structure"
                ]
              },
              "lengde": {
                "$ref": "#/schema/properties/dim/properties/components/properties/vekt"
              },
              "hoyde": {
                "$ref": "#/schema/properties/dim/properties/components/properties/vekt"
              },
              "bredde": {
                "$ref": "#/schema/properties/dim/properties/components/properties/vekt"
              },
              "volum": {
                "$ref": "#/schema/properties/dim/properties/components/properties/vekt"
              },
              "diameter": {
                "$ref": "#/schema/properties/dim/properties/components/properties/vekt"
              },
              "radius": {
                "$ref": "#/schema/properties/dim/properties/components/properties/vekt"
              }
            },
            "additionalProperties": false
          }
        },
        "required": [
          "componentId",
          "type",
          "components"
        ]
      },
      "attributer": {
        "type": "object",
        "description": "The attributes of the item.",
        "properties": {
          "componentId": {
            "type": "string",
            "description": "The component ID for attributes.",
            "enum": [
              "attributer"
            ]
          },
          "type": {
            "type": "string",
            "description": "The type of the attributes component.",
            "enum": [
              "propertiesTable"
            ]
          },
          "structure": {
            "type": "object",
            "properties": {
              "sections": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "title": {
                      "type": "string"
                    },
                    "properties": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "key": {
                            "type": "string"
                          },
                          "value": {
                            "type": "string"
                          }
                        },
                        "required": [
                          "key",
                          "value"
                        ]
                      }
                    }
                  },
                  "required": [
                    "title",
                    "properties"
                  ]
                }
              }
            },
            "required": [
              "sections"
            ]
          }
        },
        "required": [
          "componentId",
          "type",
          "structure"
        ]
      }
    },
    "required": [
      "description",
      "dim",
      "attributer"
    ],
    "additionalProperties": false
  }
}