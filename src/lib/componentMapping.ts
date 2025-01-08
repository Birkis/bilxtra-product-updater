// Base component interfaces
interface BaseComponent {
    componentId: string;
    type: string;
}

interface NumericComponent extends BaseComponent {
    type: 'numeric';
}

interface SingleLineComponent extends BaseComponent {
    type: 'singleLine';
    singleLine?: {
        text: string;
    };
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
        kon: SingleLineComponent;
        gjenger: SingleLineComponent;
        'bolt-type': SingleLineComponent;
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

// Export the actual component mapping configuration
export const componentMapping: ComponentMapping = {
    description: {
        componentId: 'product-info',
        type: 'piece',
        structure: {
            identifier: 'product-info',
            components: [{
                componentId: 'description',
                paragraphCollection: {
                    paragraphs: [{
                        body: {
                            html: '{{value}}'
                        }
                    }]
                }
            }]
        }
    },
    dim: {
        componentId: 'dim',
        type: 'componentMultipleChoice',
        components: {
            vekt: {
                componentId: 'vekt',
                type: 'numeric'
            },
            lengde: {
                componentId: 'lengde',
                type: 'numeric'
            },
            hoyde: {
                componentId: 'hoyde',
                type: 'numeric'
            },
            bredde: {
                componentId: 'bredde',
                type: 'numeric'
            },
            volum: {
                componentId: 'volum',
                type: 'numeric'
            },
            diameter: {
                componentId: 'diameter',
                type: 'numeric'
            },
            radius: {
                componentId: 'radius',
                type: 'numeric'
            },
            kon: {
                componentId: 'kon',
                type: 'singleLine'
            },
            gjenger: {
                componentId: 'gjenger',
                type: 'singleLine'
            },
            'bolt-type': {
                componentId: 'bolt-type',
                type: 'singleLine'
            },
            attributer: {
                componentId: 'attributer',
                type: 'propertiesTable',
                structure: {
                    sections: []
                }
            }
        }
    },
    produktattributer: {
        componentId: 'produktattributer',
        type: 'componentMultipleChoice',
        components: {
            attributer: {
                componentId: 'attributer',
                type: 'propertiesTable',
                structure: {
                    sections: [{
                        title: '{{title}}',
                        properties: [{
                            key: '{{key}}',
                            value: '{{value}}'
                        }]
                    }]
                }
            }
        }
    }
}; 