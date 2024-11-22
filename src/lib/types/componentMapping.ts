// Base component interfaces
interface BaseComponent {
    componentId: string;
    type: string;
}

interface NumericComponent extends BaseComponent {
    type: 'numeric';
}

interface ParagraphComponent extends BaseComponent {
    type: 'piece';
    structure: {
        identifier: string;
        components: Array<{
            componentId: string;
            paragraphCollection: {
                paragraphs: Array<{
                    body: {
                        html: string;
                    };
                }>;
            };
        }>;
    };
}

interface ComponentChoice extends BaseComponent {
    type: 'componentMultipleChoice';
    components: {
        [key: string]: {
            componentId: string;
            type: string;
        };
    };
}

// Specific component interfaces
interface DescriptionComponent extends ParagraphComponent {
    componentId: 'product-info';
}

interface DimensionsComponent extends ComponentChoice {
    componentId: 'dim';
    components: {
        vekt: NumericComponent;
        lengde: NumericComponent;
        hoyde: NumericComponent;
        bredde: NumericComponent;
        volum: NumericComponent;
        diameter: NumericComponent;
        radius: NumericComponent;
        attributer: PropertiesTableComponent;
    };
}

// Add interface for properties table component
interface PropertiesTableComponent extends BaseComponent {
    type: 'propertiesTable';
    structure: {
        sections: Array<{
            title: string;
            properties: Array<{
                key: string;
                value: string;
            }>;
        }>;
    };
}

// Define ProduktattributerComponent
interface ProduktattributerComponent extends BaseComponent {
    componentId: 'produktattributer';
    type: 'componentMultipleChoice';
    components: {
        attributer: PropertiesTableComponent;
    };
}

// Main component mapping interface
export interface ComponentMapping {
    description: DescriptionComponent;
    dim: DimensionsComponent;
    produktattributer: ProduktattributerComponent;
}

// Helper type for product data
export interface ProductData {
    description?: string;
    vekt?: {
        number: number;
        unit: string;
    };
    lengde?: {
        number: number;
        unit: string;
    };
    hoyde?: {
        number: number;
        unit: string;
    };
    bredde?: {
        number: number;
        unit: string;
    };
    volum?: {
        number: number;
        unit: string;
    };
    diameter?: {
        number: number;
        unit: string;
    };
    radius?: {
        number: number;
        unit: string;
    };
    properties?: Record<string, string>;
    produktattributer?: Record<string, string>;
} 