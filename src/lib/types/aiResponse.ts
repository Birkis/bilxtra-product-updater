export interface AIResponse {
    description?: {
        componentId: string;
        type: string;
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
    };
    dim?: {
        componentId: string;
        type: string;
        components: {
            [key: string]: {
                componentId: string;
                type: string;
                structure: {
                    number: string;
                    unit: string;
                };
            };
        };
    };
    produktattributer?: {
        componentId: string;
        type: string;
        structure: {
            sections: Array<{
                title: string;
                properties: Array<{
                    key: string;
                    value: string;
                }>;
            }>;
        };
    };
} 