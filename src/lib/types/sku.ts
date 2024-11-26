export interface SKUFields {
    sku: string;
    name?: string;
    description?: string;
    category?: string;
    dim?: {
        vekt?: { number: number; unit: string; };
        lengde?: { number: number; unit: string; };
        hoyde?: { number: number; unit: string; };
        bredde?: { number: number; unit: string; };
        volum?: { number: number; unit: string; };
        diameter?: { number: number; unit: string; };
        radius?: { number: number; unit: string; };
    };
    produktattributer?: {
        attributer?: {
            sections: Array<{
                title: string;
                properties: Array<{
                    key: string;
                    value: string;
                }>;
            }>;
        };
    };
    aiGenerated?: {
        name?: boolean;
        description?: boolean;
        category?: boolean;
    };
}

export const SKU_FIELD_LABELS: Record<string, string> = {
    sku: 'SKU (Required)',
    name: 'Product Name (Optional)',
    description: 'Description (Optional)',
    category: 'Category (Optional)'
};

export const DIMENSION_FIELDS = {
    vekt: 'Weight',
    lengde: 'Length',
    hoyde: 'Height',
    bredde: 'Width',
    volum: 'Volume',
    diameter: 'Diameter',
    radius: 'Radius'
} as const;

export const COMMON_UNITS = {
    weight: ['kg', 'g', 'lbs', 'oz'],
    length: ['m', 'cm', 'mm', 'in', 'ft'],
    volume: ['l', 'ml', 'm³', 'cm³'],
} as const;

export const AI_GENERATABLE_FIELDS = ['name', 'description', 'category'] as const;

export interface AttributeSection {
    title: string;
    properties: Array<{
        key: string;
        value: string;
    }>;
}

export const PREDEFINED_ATTRIBUTE_SECTIONS = [
    {
        title: 'Technical Specifications',
        suggestedProperties: ['Material', 'Color', 'Finish', 'Manufacturing Method']
    },
    {
        title: 'Packaging',
        suggestedProperties: ['Package Type', 'Units per Package', 'Package Dimensions']
    },
    {
        title: 'Certifications',
        suggestedProperties: ['CE Mark', 'ISO', 'Environmental Certifications']
    }
] as const; 