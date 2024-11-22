<script lang="ts">
    import type { PageData } from './$types';
    import { page } from '$app/stores';
    import type { ProductData } from '$lib/types/componentMapping';
    import type { AIResponse } from '$lib/types/aiResponse';
    
    export let data: PageData;
    const { product } = data;

    const showDebug = true;
    
    // Add edit mode state
    let isEditing = false;

    // Update edit mode state for description
    let editedDescription = product.browse?.generiskProdukt?.hits?.[0]?.productInfo?.description?.[0]?.body?.[0]?.textContent || '';
    const originalDescription = editedDescription;

    // Update input state management
    let inputs = {
        text: { enabled: false, value: '' },
        url: { enabled: false, value: '' },
        imageFile: { enabled: false, value: null as File | null }
    };

    let isLoading = false;

    let aiResponse: {
        [key: string]: any;
        description?: {
            structure: {
                components: Array<{
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
    } | null = null;
    let showUpdateOptions = false;

    // Add this state management for editable AI response
    let editableAIResponse: Partial<AIResponse> | null = null;

    // Add this function to initialize editable response when AI response is received
    function initializeEditableResponse() {
        if (!aiResponse) return;
        
        editableAIResponse = {
            description: aiResponse.description && {
                ...aiResponse.description,
                structure: {
                    ...aiResponse.description.structure,
                    components: [{
                        ...aiResponse.description.structure.components[0],
                        paragraphCollection: {
                            paragraphs: [{
                                body: {
                                    html: aiResponse.description.structure.components[0]
                                        .paragraphCollection.paragraphs[0].body.html
                                }
                            }]
                        }
                    }]
                }
            },
            dim: aiResponse.dim && {
                ...aiResponse.dim,
                components: { ...aiResponse.dim.components }
            },
            attributer: aiResponse.attributer && {
                ...aiResponse.attributer,
                structure: {
                    sections: [...aiResponse.attributer.structure.sections]
                }
            }
        };
    }

    // Update the mapping to handle the new structure
    const aiToComponentMapping = {
        description: {
            key: 'description',
            transform: (value: AIResponse['description']) => {
                if (!value?.structure?.components?.[0]?.paragraphCollection?.paragraphs?.[0]?.body?.html) {
                    return '';
                }
                return value.structure.components[0].paragraphCollection.paragraphs[0].body.html;
            }
        },
        vekt: {
            key: 'vekt',
            transform: (component: any) => ({
                number: Number(component.structure.number),
                unit: component.structure.unit
            })
        },
        lengde: {
            key: 'lengde',
            transform: (component: any) => ({
                number: Number(component.structure.number),
                unit: component.structure.unit
            })
        },
        hoyde: {
            key: 'hoyde',
            transform: (component: any) => ({
                number: Number(component.structure.number),
                unit: component.structure.unit
            })
        },
        bredde: {
            key: 'bredde',
            transform: (component: any) => ({
                number: Number(component.structure.number),
                unit: component.structure.unit
            })
        },
        attributer: {
            key: 'produktattributer',
            transform: (structure: any) => {
                const properties: Record<string, string> = {};
                structure.sections[0]?.properties.forEach((property: { key: string; value: string }) => {
                    properties[property.key] = property.value;
                });
                return properties;
            },
        },
    } as const;

    // Add drag and drop state
    let isDragging = false;

    function handleDragEnter(event: DragEvent) {
        event.preventDefault();
        isDragging = true;
    }

    function handleDragLeave(event: DragEvent) {
        event.preventDefault();
        isDragging = false;
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        isDragging = false;
        
        if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
            const file = event.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                inputs.imageFile.value = file;
            } else {
                alert('Please drop an image file');
            }
        }
    }

    async function handleSaveDescription() {
        try {
            const response = await fetch('/api/update-product', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    itemId: $page.params.productId,
                    description: [{
                        body: [{
                            kind: "inline",
                            textContent: editedDescription
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update description');
            }

            const result = await response.json();
            if (result.errorName) {
                throw new Error(result.message || 'Failed to update description');
            }

            // Show success message
            alert('Description updated successfully!');
            
            // Exit edit mode after successful save
            isEditing = false;
            
            // Reload the page to show updated data
            window.location.reload();
        } catch (error) {
            console.error('Error updating description:', error);
            alert('Failed to update description');
        }
    }

    function handleCancel() {
        editedDescription = originalDescription;
        isEditing = false;
    }

    async function compressImage(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                // More aggressive size reduction (max 1000px width/height)
                let width = img.width;
                let height = img.height;
                const maxSize = 1000;
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress image
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Convert to JPEG with more aggressive compression
                const compressedImage = canvas.toDataURL('image/jpeg', 0.6); // Reduced quality to 60%
                
                // Check the size of the compressed image
                const base64Data = compressedImage.split(',')[1];
                const binaryData = atob(base64Data);
                const size = binaryData.length;
                
                // If still too large, compress further
                if (size > 5 * 1024 * 1024) { // If larger than 5MB
                    const scaleFactor = Math.sqrt(5 * 1024 * 1024 / size);
                    const newWidth = Math.floor(width * scaleFactor);
                    const newHeight = Math.floor(height * scaleFactor);
                    
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    ctx?.drawImage(img, 0, 0, newWidth, newHeight);
                    
                    // Try with even more compression
                    resolve(canvas.toDataURL('image/jpeg', 0.4)); // Further reduced quality to 40%
                } else {
                    resolve(compressedImage);
                }
            };
            
            img.onerror = reject;
            
            // Load image from file
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    img.src = e.target.result as string;
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Add this helper function to check file size
    function getBase64Size(base64String: string): number {
        const base64Data = base64String.split(',')[1];
        return atob(base64Data).length;
    }

    // Update the handleAISubmit function to include size checking
    async function handleAISubmit() {
        isLoading = true;
        showUpdateOptions = false;
        try {
            const message: { text?: string; url?: string; image?: string } = {};
            
            // Collect all enabled inputs
            if (inputs.text.enabled && inputs.text.value) {
                message.text = inputs.text.value;
            }
            
            if (inputs.url.enabled && inputs.url.value) {
                message.url = inputs.url.value;
            }
            
            if (inputs.imageFile.enabled && inputs.imageFile.value) {
                try {
                    const compressedImage = await compressImage(inputs.imageFile.value);
                    const imageSize = getBase64Size(compressedImage);
                    
                    if (imageSize > 10 * 1024 * 1024) { // 10MB limit
                        throw new Error('Image is too large even after compression. Please try a smaller image.');
                    }
                    
                    message.image = compressedImage;
                } catch (error) {
                    console.error('Error compressing image:', error);
                    throw new Error('Failed to process image. Please try a smaller image or different format.');
                }
            }

            if (Object.keys(message).length === 0) {
                throw new Error('Please provide at least one input');
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    type: 'multiple'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to process content');
            }

            const data = await response.json();
            aiResponse = typeof data.response === 'string' 
                ? JSON.parse(data.response) 
                : data.response;
            
            initializeEditableResponse();
            showUpdateOptions = true;
        } catch (error) {
            console.error('Error processing content:', error);
            alert(error instanceof Error ? error.message : 'Failed to process content');
        } finally {
            isLoading = false;
        }
    }

    // Add this near the top of the script section
    interface UpdateFields {
        description: boolean;
        dimensions: boolean;
        attributes: boolean;
    }

    let fieldsToUpdate: UpdateFields = {
        description: true,
        dimensions: true,
        attributes: true
    };

    // Update the updateProductWithAIData function
    async function updateProductWithAIData(responseToUse = aiResponse) {
        if (!responseToUse) return;

        try {
            const productData: Partial<ProductData> = {};
            
            // Only include fields that are checked
            if (fieldsToUpdate.description && responseToUse.description) {
                const mapping = aiToComponentMapping['description'];
                productData[mapping.key] = mapping.transform(responseToUse.description);
            }

            if (fieldsToUpdate.dimensions && responseToUse.dim?.components) {
                Object.entries(responseToUse.dim.components).forEach(([key, component]) => {
                    const mapping = aiToComponentMapping[key as keyof typeof aiToComponentMapping];
                    if (mapping) {
                        productData[mapping.key] = mapping.transform(component);
                    }
                });
            }

            if (fieldsToUpdate.attributes && responseToUse.attributer) {
                const mapping = aiToComponentMapping['attributer'];
                productData[mapping.key] = mapping.transform(responseToUse.attributer.structure);
            }

            // Only proceed if at least one field is selected
            if (Object.keys(productData).length === 0) {
                alert('Please select at least one field to update');
                return;
            }

            const response = await fetch('/api/core-api-mutate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    itemId: $page.params.productId,
                    productData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update product');
            }

            const result = await response.json();
            if (result.errorName) {
                throw new Error(result.message || 'Failed to update product');
            }

            alert('Product updated successfully!');
            window.location.reload();
        } catch (error) {
            console.error('Error updating product:', error);
            alert(error instanceof Error ? error.message : 'Failed to update product');
        }
    }

    function handleFileSelect(event: Event & { currentTarget: HTMLInputElement }) {
        if (event.currentTarget.files && event.currentTarget.files[0]) {
            inputs.imageFile.value = event.currentTarget.files[0];
        }
    }

    // Add function to handle input type selection
    function handleInputTypeChange(type: 'text' | 'url' | 'imageFile', checked: boolean) {
        // If enabling this type, disable others
        if (checked) {
            inputs.text.enabled = type === 'text';
            inputs.url.enabled = type === 'url';
            inputs.imageFile.enabled = type === 'imageFile';
            
            // Clear other values
            if (type !== 'text') inputs.text.value = '';
            if (type !== 'url') inputs.url.value = '';
            if (type !== 'imageFile') inputs.imageFile.value = null;
        } else {
            // Just disable the selected type
            inputs[type].enabled = false;
        }
    }

    // Add function to update editable values
    function updateEditableValue(path: string[], value: any) {
        if (!editableAIResponse) return;
        
        let current: any = editableAIResponse;
        for (let i = 0; i < path.length - 1; i++) {
            if (!current[path[i]]) return;
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }
</script>

<div class="px-5 max-w-7xl mx-auto">
    {#if showDebug}
        <pre class="bg-gray-100 p-4 rounded overflow-x-auto text-sm mb-4 border border-gray-300">
            {JSON.stringify(product, null, 2)}
        </pre>
    {/if}
    
    {#if product.browse?.generiskProdukt?.hits?.[0]?.defaultVariant?.name}
        <h1 class="text-4xl font-extrabold text-gray-900 mb-8">
            {product.browse.generiskProdukt.hits[0].defaultVariant.name}
        </h1>
    {/if}
    
    <div class="my-8">
        <div class="flex justify-between items-center mb-6">
            <div>
                <h2 class="text-2xl font-semibold text-gray-800">Description</h2>
                {#if product.browse?.generiskProdukt?.hits?.[0]?.defaultVariant?.sku}
                    <p class="text-sm text-gray-500 mt-1">
                        SKU: {product.browse.generiskProdukt.hits[0].defaultVariant.sku}
                    </p>
                {/if}
            </div>
        </div>
        
        <p class="leading-relaxed text-gray-700">{editedDescription}</p>
    </div>
</div>

<div class="mt-12 p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
    <h2 class="text-2xl font-semibold text-gray-800 mb-6">AI Content Analysis</h2>
    
    <div class="flex items-center space-x-6 mb-6">
        <label class="flex items-center space-x-2">
            <input 
                type="checkbox" 
                checked={inputs.text.enabled}
                on:change={(e) => handleInputTypeChange('text', e.currentTarget.checked)}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span class="text-gray-700">Text</span>
        </label>
        <label class="flex items-center space-x-2">
            <input 
                type="checkbox" 
                checked={inputs.url.enabled}
                on:change={(e) => handleInputTypeChange('url', e.currentTarget.checked)}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span class="text-gray-700">URL</span>
        </label>
        <label class="flex items-center space-x-2">
            <input 
                type="checkbox" 
                checked={inputs.imageFile.enabled}
                on:change={(e) => handleInputTypeChange('imageFile', e.currentTarget.checked)}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span class="text-gray-700">Image</span>
        </label>
    </div>

    <div class="space-y-6">
        {#if inputs.text.enabled}
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Text Input</label>
                <textarea
                    bind:value={inputs.text.value}
                    placeholder="Enter your text here..."
                    rows="4"
                    class="w-full p-3 border border-gray-300 rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                ></textarea>
            </div>
        {/if}

        {#if inputs.url.enabled}
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">URL Input</label>
                <input
                    type="url"
                    bind:value={inputs.url.value}
                    placeholder="Enter URL here..."
                    class="w-full p-3 border border-gray-300 rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
        {/if}

        {#if inputs.imageFile.enabled}
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Image Input</label>
                <div
                    role="presentation"
                    class={`relative p-6 border-2 rounded-md cursor-pointer transition-colors ${
                        isDragging ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300'
                    }`}
                    on:dragenter={handleDragEnter}
                    on:dragleave={handleDragLeave}
                    on:dragover={handleDragOver}
                    on:drop={handleDrop}
                >
                    <input
                        type="file"
                        accept="image/*"
                        on:change={handleFileSelect}
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div class="flex flex-col items-center justify-center">
                        <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48">
                            <path d="M24 4v40m20-20H4" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <p class="mt-1 text-sm text-gray-600">Drag and drop an image here, or click to select</p>
                        {#if inputs.imageFile.value}
                            <p class="text-sm text-green-600 mt-2">Selected: {inputs.imageFile.value.name}</p>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}

        <button 
            class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            {isLoading || (!inputs.text.enabled && !inputs.url.enabled && !inputs.imageFile.enabled)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'}"
            on:click={handleAISubmit}
            disabled={isLoading || (!inputs.text.enabled && !inputs.url.enabled && !inputs.imageFile.enabled)}
        >
            {isLoading ? 'Processing...' : 'Analyze Content'}
        </button>
    </div>

    {#if isLoading}
        <div class="text-center py-6 text-gray-600">
            <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
            Processing your content...
        </div>
    {/if}

    {#if aiResponse && editableAIResponse}
        <div class="mt-8">
            <h3 class="text-xl font-semibold text-gray-800 mb-4">Analysis Results</h3>
            
            <!-- Description Section -->
            {#if editableAIResponse.description}
                <div class="my-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-lg font-medium text-gray-700">Description</h4>
                        <label class="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                bind:checked={fieldsToUpdate.description}
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span class="text-sm text-gray-600">Include in update</span>
                        </label>
                    </div>
                    <textarea
                        class="w-full p-3 border border-gray-300 rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500 min-h-[150px]"
                        value={editableAIResponse.description.structure.components[0].paragraphCollection.paragraphs[0].body.html}
                        on:input={(e) => updateEditableValue(
                            ['description', 'structure', 'components', 0, 'paragraphCollection', 'paragraphs', 0, 'body', 'html'],
                            e.currentTarget.value
                        )}
                    ></textarea>
                </div>
            {/if}

            <!-- Dimensions Section -->
            {#if editableAIResponse.dim?.components}
                <div class="my-6">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-lg font-medium text-gray-700">Dimensions</h4>
                        <label class="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                bind:checked={fieldsToUpdate.dimensions}
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span class="text-sm text-gray-600">Include in update</span>
                        </label>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {#each ['vekt', 'lengde', 'hoyde', 'bredde'] as dimension}
                            {#if editableAIResponse.dim?.components[dimension]}
                                <div class="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <h5 class="text-md font-medium text-gray-700 mb-4">
                                        {dimension.charAt(0).toUpperCase() + dimension.slice(1)}
                                    </h5>
                                    <div class="flex gap-4">
                                        <input
                                            type="number"
                                            class="flex-1 p-3 border border-gray-300 rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                                            value={editableAIResponse.dim.components[dimension].structure.number}
                                            on:input={(e) => updateEditableValue(
                                                ['dim', 'components', dimension, 'structure', 'number'],
                                                e.currentTarget.value
                                            )}
                                        />
                                        <input
                                            type="text"
                                            class="w-24 p-3 border border-gray-300 rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                                            value={editableAIResponse.dim.components[dimension].structure.unit}
                                            on:input={(e) => updateEditableValue(
                                                ['dim', 'components', dimension, 'structure', 'unit'],
                                                e.currentTarget.value
                                            )}
                                        />
                                    </div>
                                </div>
                            {/if}
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Attributes Section -->
            {#if editableAIResponse.attributer?.structure.sections[0]}
                <div class="my-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-lg font-medium text-gray-700">Product Attributes</h4>
                        <label class="flex items-center space-x-2">
                            <input 
                                type="checkbox" 
                                bind:checked={fieldsToUpdate.attributes}
                                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span class="text-sm text-gray-600">Include in update</span>
                        </label>
                    </div>
                    <div class="space-y-4">
                        {#each editableAIResponse.attributer.structure.sections[0].properties as property, index}
                            <div class="flex gap-4">
                                <input
                                    type="text"
                                    class="flex-1 p-3 border border-gray-300 rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                                    value={property.key}
                                    on:input={(e) => updateEditableValue(
                                        ['attributer', 'structure', 'sections', 0, 'properties', index, 'key'],
                                        e.currentTarget.value
                                    )}
                                />
                                <input
                                    type="text"
                                    class="flex-1 p-3 border border-gray-300 rounded-md text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                                    value={property.value}
                                    on:input={(e) => updateEditableValue(
                                        ['attributer', 'structure', 'sections', 0, 'properties', index, 'value'],
                                        e.currentTarget.value
                                    )}
                                />
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Update Button -->
            {#if showUpdateOptions}
                <div class="my-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 class="font-semibold text-gray-800 mb-4">Update Product</h4>
                    <div class="text-sm text-gray-600 mb-4">
                        Selected fields: 
                        {[
                            fieldsToUpdate.description && 'Description',
                            fieldsToUpdate.dimensions && 'Dimensions',
                            fieldsToUpdate.attributes && 'Attributes'
                        ].filter(Boolean).join(', ') || 'None'}
                    </div>
                    <button 
                        class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-semibold rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                        {(!fieldsToUpdate.description && !fieldsToUpdate.dimensions && !fieldsToUpdate.attributes)
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'}"
                        on:click={() => updateProductWithAIData(editableAIResponse)}
                        disabled={!fieldsToUpdate.description && !fieldsToUpdate.dimensions && !fieldsToUpdate.attributes}
                    >
                        Update Selected Fields
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>