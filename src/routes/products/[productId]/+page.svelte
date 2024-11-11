<script lang="ts">
    import type { PageData } from './$types';
    import { page } from '$app/stores';
    
    export let data: PageData;
    const { product } = data;

    const showDebug = true;
    
    // Add edit mode state
    let isEditing = false;
    let editedPrice = product.variants?.[0]?.price?.toString() || '';

    async function handleSavePrice() {
        try {
            const response = await fetch('/api/update-product', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    productId: product.id,
                    price: editedPrice
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update price');
            }

            // Exit edit mode after successful save
            isEditing = false;
            
            // Reload the page to show updated data
            window.location.reload();
        } catch (error) {
            console.error('Error updating price:', error);
            alert('Failed to update price');
        }
    }
</script>

<div class="product-details">
    {#if showDebug}
        <pre class="debug">
            {JSON.stringify(product, null, 2)}
        </pre>
    {/if}
    
    <h1>{product.name}</h1>
    
    <!-- Price Editor -->
    <div class="price-section">
        <div class="price-header">
            <h2>Price: {product.variants?.[0]?.price || 'N/A'}</h2>
            {#if !isEditing}
                <button on:click={() => isEditing = true}>Edit Price</button>
            {:else}
                <div class="edit-controls">
                    <input 
                        type="number" 
                        bind:value={editedPrice}
                        step="0.01"
                        class="price-editor"
                    />
                    <button on:click={handleSavePrice}>Save</button>
                    <button on:click={() => isEditing = false}>Cancel</button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .product-details {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .debug {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 0.875rem;
        margin-bottom: 1rem;
        border: 1px solid #ddd;
    }

    .price-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .edit-controls {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .price-editor {
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        width: 100px;
    }

    button {
        padding: 0.5rem 1rem;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    button:hover {
        background-color: #0056b3;
    }
</style>