<script lang="ts">
    import type { PageData } from './$types';
    import { page } from '$app/stores';
    import type { ProductData } from '$lib/types/componentMapping';
    
    export let data: PageData;
    const { product } = data;

    const showDebug = true;
    
    // Add edit mode state
    let isEditing = false;

    // Update edit mode state for description
    let editedDescription = product.browse?.generiskProdukt?.hits?.[0]?.productInfo?.description?.[0]?.body?.[0]?.textContent || '';
    const originalDescription = editedDescription;

    // Add state for AI input
    let inputType: 'text' | 'url' | 'image' = 'text';
    let textInput = '';
    let urlInput = '';
    let imageFile: File | null = null;
    let isLoading = false;

    interface AIResponse {
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
        weight?: {
            number: number;
            unit: string;
        };
        length?: {
            number: number;
            unit: string;
        };
        height?: {
            number: number;
            unit: string;
        };
        width?: {
            number: number;
            unit: string;
        };
    }

    let aiResponse: AIResponse | null = null;
    let showUpdateOptions = false;

    // Update the mapping to handle the new structure
    const aiToComponentMapping = {
        description: {
            key: 'description',
            transform: (value: AIResponse['description']) => 
                value?.structure?.components[0]?.paragraphCollection?.paragraphs[0]?.body?.html || ''
        },
        weight: {
            key: 'vekt',
            transform: (value: { number: number; unit: string }) => value
        },
        length: {
            key: 'lengde',
            transform: (value: { number: number; unit: string }) => value
        },
        height: {
            key: 'hoyde',
            transform: (value: { number: number; unit: string }) => value
        },
        width: {
            key: 'bredde',
            transform: (value: { number: number; unit: string }) => value
        }
    } as const;

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

    async function handleAISubmit() {
        isLoading = true;
        showUpdateOptions = false;
        try {
            let content;
            
            if (inputType === 'image' && imageFile) {
                // Convert image to base64 data URL
                const reader = new FileReader();
                content = await new Promise<string>((resolve) => {
                    reader.onload = (e) => {
                        if (e.target?.result) {
                            resolve(e.target.result as string);
                        }
                    };
                    reader.readAsDataURL(imageFile as Blob);
                });
            } else {
                content = inputType === 'text' ? textInput : urlInput;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: content,
                    type: inputType
                })
            });

            if (!response.ok) {
                throw new Error('Failed to process content');
            }

            const data = await response.json();
            // Parse the response string into an object if it's a string
            aiResponse = typeof data.response === 'string' 
                ? JSON.parse(data.response) 
                : data.response;
            
            showUpdateOptions = true;
        } catch (error) {
            console.error('Error processing content:', error);
            alert('Failed to process content');
        } finally {
            isLoading = false;
        }
    }

    async function updateProductWithAIData() {
        if (!aiResponse) return;

        try {
            const productData: Partial<ProductData> = {};
            
            Object.entries(aiResponse).forEach(([key, value]) => {
                const mapping = aiToComponentMapping[key as keyof typeof aiToComponentMapping];
                if (mapping && value) {
                    productData[mapping.key] = mapping.transform(value);
                }
            });

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

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            imageFile = input.files[0];
        }
    }
</script>

<div class="p-5 max-w-7xl mx-auto">
    {#if showDebug}
        <pre class="bg-gray-100 p-4 rounded overflow-x-auto text-sm mb-4 border border-gray-300">
            {JSON.stringify(product, null, 2)}
        </pre>
    {/if}
    
    {#if product.browse?.generiskProdukt?.hits?.[0]?.defaultVariant?.name}
        <h1 class="text-3xl font-bold mb-6">{product.browse.generiskProdukt.hits[0].defaultVariant.name}</h1>
    {/if}
    
    <div class="my-8">
        <div class="flex justify-between items-center mb-4">
            <div>
                <h2 class="text-xl font-semibold">Description</h2>
                {#if product.browse?.generiskProdukt?.hits?.[0]?.defaultVariant?.sku}
                    <p class="text-sm text-gray-600 mt-1">SKU: {product.browse.generiskProdukt.hits[0].defaultVariant.sku}</p>
                {/if}
            </div>
            {#if !isEditing}
                <button class="bg-gray-600 text-white px-4 py-2 rounded hover:opacity-90" on:click={() => isEditing = true}>
                    Edit Description
                </button>
            {/if}
        </div>
        
        {#if isEditing}
            <div class="flex flex-col gap-4">
                <textarea 
                    bind:value={editedDescription}
                    rows="5"
                    class="w-full p-2 border border-gray-300 rounded font-inherit text-base leading-relaxed"
                    placeholder="Enter product description"
                ></textarea>
                <div class="flex gap-4">
                    <button class="bg-green-600 text-white px-4 py-2 rounded hover:opacity-90" on:click={handleSaveDescription}>
                        Save
                    </button>
                    <button class="bg-red-600 text-white px-4 py-2 rounded hover:opacity-90" on:click={handleCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        {:else}
            <p class="leading-relaxed text-gray-700">{editedDescription}</p>
        {/if}
    </div>
</div>

<div class="mt-8 p-4 border border-gray-300 rounded-lg">
    <h2 class="text-xl font-semibold mb-4">AI Content Analysis</h2>
    
    <div class="flex gap-4 mb-4">
        <button 
            class="px-4 py-2 rounded {inputType === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}"
            on:click={() => inputType = 'text'}
        >
            Text
        </button>
        <button 
            class="px-4 py-2 rounded {inputType === 'url' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}"
            on:click={() => inputType = 'url'}
        >
            URL
        </button>
        <button 
            class="px-4 py-2 rounded {inputType === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}"
            on:click={() => inputType = 'image'}
        >
            Image
        </button>
    </div>

    <div class="flex flex-col gap-4">
        {#if inputType === 'text'}
            <textarea
                bind:value={textInput}
                placeholder="Enter your text here..."
                rows="4"
                class="w-full p-2 border border-gray-300 rounded font-inherit"
            ></textarea>
        {:else if inputType === 'url'}
            <input
                type="url"
                bind:value={urlInput}
                placeholder="Enter URL here..."
                class="w-full p-2 border border-gray-300 rounded"
            />
        {:else}
            <input
                type="file"
                accept="image/*"
                on:change={handleFileSelect}
                class="p-4 border-2 border-dashed border-gray-300 rounded cursor-pointer"
            />
            {#if imageFile}
                <p class="text-sm text-gray-600">Selected: {imageFile.name}</p>
            {/if}
        {/if}

        <button 
            class="bg-blue-600 text-white py-3 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:opacity-90"
            on:click={handleAISubmit}
            disabled={isLoading}
        >
            {isLoading ? 'Processing...' : 'Analyze Content'}
        </button>
    </div>

    {#if isLoading}
        <div class="text-center py-4 text-gray-600">
            Processing your content...
        </div>
    {/if}

    {#if aiResponse}
        <div class="mt-4 p-4 bg-gray-50 rounded">
            <h3 class="text-lg font-semibold mb-4">Analysis Results</h3>
            
            {#if aiResponse.description}
                <div class="my-4 p-4 bg-white border border-gray-300 rounded">
                    <h4 class="font-semibold text-gray-700 mb-2">Description</h4>
                    <p class="text-gray-600">
                        {aiResponse.description.structure.components[0].paragraphCollection.paragraphs[0].body.html}
                    </p>
                </div>
            {/if}

            {#each ['weight', 'length', 'height', 'width'] as dimension}
                {#if aiResponse[dimension]}
                    <div class="my-4 p-4 bg-white border border-gray-300 rounded">
                        <h4 class="font-semibold text-gray-700 mb-2">
                            {dimension.charAt(0).toUpperCase() + dimension.slice(1)}
                        </h4>
                        <p class="text-gray-600">
                            {aiResponse[dimension].number} {aiResponse[dimension].unit}
                        </p>
                    </div>
                {/if}
            {/each}

            {#if showUpdateOptions}
                <div class="my-6 p-4 bg-blue-50 rounded">
                    <h4 class="font-semibold mb-2">Update Product</h4>
                    <button 
                        class="w-full bg-green-600 text-white py-3 px-4 rounded hover:opacity-90"
                        on:click={updateProductWithAIData}
                    >
                        Update Product with Extracted Data
                    </button>
                </div>
            {/if}

            <div class="mt-6">
                <h4 class="font-semibold mb-2">Raw Data</h4>
                <pre class="whitespace-pre-wrap break-words bg-white p-4 rounded border border-gray-300">
                    {JSON.stringify(aiResponse, null, 2)}
                </pre>
            </div>
        </div>
    {/if}
</div>