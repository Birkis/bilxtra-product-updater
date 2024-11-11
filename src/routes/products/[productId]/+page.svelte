<script lang="ts">
    import type { PageData } from './$types';
    
    export let data: PageData;
    const { product } = data;
</script>

<div class="product-details">
    <h1>{product.name}</h1>
    
    {#if product.variants && product.variants.length > 0}
        <div class="variant-info">
            <h2>Variant Details:</h2>
            {#each product.variants as variant}
                <div class="variant">
                    <h3>{variant.name}</h3>
                    <p>SKU: {variant.sku}</p>
                    <p>Price: {variant.price}</p>
                    <p>Stock: {variant.stock}</p>
                    
                    {#if variant.images && variant.images.length > 0}
                        <img 
                            src={variant.images[0].url} 
                            alt={variant.images[0].altText || variant.name}
                            width="300"
                        >
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    {#if product.components}
        <div class="components">
            <h2>Product Components:</h2>
            {#each product.components as component}
                <div class="component">
                    <h3>{component.name}</h3>
                    
                    {#if component.content && component.type === 'richText'}
                        {@html component.content.html}
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .product-details {
        padding: 20px;
    }
    
    .variant {
        margin-bottom: 20px;
        padding: 10px;
        border: 1px solid #ccc;
    }
    
    .component {
        margin-bottom: 15px;
    }
</style>