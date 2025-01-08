<!-- 
  Search Page Component
  This component provides a user interface for searching products using the Crystallize API.
  It includes a search input field and displays search results with error handling.
-->
<script lang="ts">
    import type { PageData } from './$types';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { searchStore } from '$lib/stores/searchStore';

    let { data }: { data: PageData } = $props();
    let searchInput = $state($page.url.searchParams.get('q') || '');
    let isSearching = $state(false);
    let selectedProducts = $state(new Set<string>());

    function toggleProductSelection(productId: string) {
        if (selectedProducts.has(productId)) {
            selectedProducts.delete(productId);
        } else {
            selectedProducts.add(productId);
        }
        selectedProducts = selectedProducts; // trigger reactivity
    }

    function selectAllProducts() {
        if (selectedProducts.size === $searchResults.products.length) {
            selectedProducts = new Set(); // Create a new empty Set to trigger reactivity
        } else {
            selectedProducts = new Set($searchResults.products.map(p => p.itemId));
        }
    }

    // Initialize store with server-side data
    $effect(() => {
        if (data) {
            searchStore.setRawResults(data.products, data.totalBeforeFilter || 0);
            searchStore.setSearchTerm(data.searchTerm || '');
            if (data.error) {
                searchStore.setError(data.error);
            }
        }
    });

    // Filter states
    let hasGeneralImage = $state($page.url.searchParams.get('hasGeneralImage') || '');
    let hasShortcuts = $state($page.url.searchParams.get('hasShortcuts') || '');
    let isPublished = $state($page.url.searchParams.get('isPublished') || '');
    let isDraft = $state($page.url.searchParams.get('isDraft') || '');
    let hasVariantImage = $state($page.url.searchParams.get('hasVariantImage') || '');

    // Update store filters when URL parameters change
    $effect(() => {
        const filters = {
            hasGeneralImage: hasGeneralImage === 'true' ? true : 
                           hasGeneralImage === 'false' ? false : 
                           undefined,
            hasShortcuts: hasShortcuts === 'true' ? true :
                         hasShortcuts === 'false' ? false :
                         undefined,
            isPublished: isPublished === 'true' ? true :
                        isPublished === 'false' ? false :
                        undefined,
            isDraft: isDraft === 'true' ? true :
                    isDraft === 'false' ? false :
                    undefined,
            hasVariantImage: hasVariantImage === 'true' ? true :
                            hasVariantImage === 'false' ? false :
                            undefined
        };
        searchStore.setFilters(filters);
    });

    // Subscribe to store for filtered results
    const searchResults = searchStore;

    function exportToCsv() {
        if (!$searchResults.products.length) return;

        // Define CSV headers
        const headers = [
            'Name',
            'SKUs',
            'Publication State',
            'Has General Image',
            'Has Variant Image',
            'Has Shortcuts'
        ];

        // Convert products to CSV rows
        const rows = $searchResults.products.map(product => [
            // Escape quotes in the name to prevent CSV issues
            `"${product.name.replace(/"/g, '""')}"`,
            // Join all SKUs with a semicolon
            `"${product.variants.map(v => v.sku).join(';')}"`,
            product.publicationState,
            Boolean(product.productInfo?.generalProductImages?.length),
            Boolean(product.variants.some(v => v.images?.length)),
            Boolean(product.shortcuts?.length)
        ]);

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `product-search-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Handles the search form submission
     * Updates the URL with the search query and filters
     */
    async function handleSearch(event: SubmitEvent) {
        event.preventDefault();
        isSearching = true;
        searchStore.setLoading(true);
        
        const searchParams = new URLSearchParams();
        if (searchInput.trim()) {
            searchParams.set('q', searchInput);
        }
        
        // Add filters to URL if they're set
        if (hasGeneralImage) searchParams.set('hasGeneralImage', hasGeneralImage);
        if (hasShortcuts) searchParams.set('hasShortcuts', hasShortcuts);
        if (isPublished) searchParams.set('isPublished', isPublished);
        if (isDraft) searchParams.set('isDraft', isDraft);
        if (hasVariantImage) searchParams.set('hasVariantImage', hasVariantImage);

        await goto(`?${searchParams.toString()}`);
        isSearching = false;
        searchStore.setLoading(false);
    }

    const filterOptions = [
        { value: '', label: 'No filter' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
    ];
</script>

<div class="search-container">
    <form on:submit={handleSearch} class="search-form">
        <div class="search-row">
            <input
                type="search"
                bind:value={searchInput}
                placeholder="Search products..."
                class="search-input"
                disabled={isSearching}
            />
            <button type="submit" class="search-button" disabled={isSearching}>
                {#if isSearching}
                    Searching...
                {:else}
                    Search
                {/if}
            </button>
        </div>

        <div class="filters-row">
            <div class="filter-group">
                <label for="hasGeneralImage">General Image:</label>
                <select 
                    id="hasGeneralImage" 
                    bind:value={hasGeneralImage}
                    disabled={isSearching}
                >
                    {#each filterOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>

            <div class="filter-group">
                <label for="hasVariantImage">Variant Image:</label>
                <select 
                    id="hasVariantImage" 
                    bind:value={hasVariantImage}
                    disabled={isSearching}
                >
                    {#each filterOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>

            <div class="filter-group">
                <label for="hasShortcuts">Shortcuts:</label>
                <select 
                    id="hasShortcuts" 
                    bind:value={hasShortcuts}
                    disabled={isSearching}
                >
                    {#each filterOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>

            <div class="filter-group">
                <label for="isPublished">Published:</label>
                <select 
                    id="isPublished" 
                    bind:value={isPublished}
                    disabled={isSearching}
                >
                    {#each filterOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>

            <div class="filter-group">
                <label for="isDraft">Draft:</label>
                <select 
                    id="isDraft" 
                    bind:value={isDraft}
                    disabled={isSearching}
                >
                    {#each filterOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>
        </div>
    </form>

    {#if $searchResults.error}
        <div class="error-message">
            {$searchResults.error}
        </div>
    {/if}

    {#if $searchResults.products.length > 0}
        <div class="results-container">
            <div class="results-header">
                <div class="results-title">
                    <div class="results-title-row">
                        {#if $searchResults.products.length > 0}
                            <input 
                                type="checkbox"
                                class="checkbox"
                                checked={selectedProducts.size === $searchResults.products.length}
                                indeterminate={selectedProducts.size > 0 && selectedProducts.size < $searchResults.products.length}
                                on:change={selectAllProducts}
                            />
                        {/if}
                        <h2>Search Results</h2>
                    </div>
                    <span class="results-count">
                        {$searchResults.totalCount} products found
                        {#if $searchResults.totalBeforeFilter !== $searchResults.totalCount}
                            (filtered from {$searchResults.totalBeforeFilter})
                        {/if}
                        {#if selectedProducts.size > 0}
                            <span class="selected-count">
                                ({selectedProducts.size} selected)
                            </span>
                        {/if}
                    </span>
                </div>
                <button 
                    class="export-button"
                    on:click={exportToCsv}
                    title="Export results to CSV"
                >
                    Export to CSV
                </button>
            </div>
            <ul class="product-list">
                {#each $searchResults.products as product}
                    <li class="product-item">
                        <div class="product-header">
                            <input 
                                type="checkbox"
                                class="checkbox"
                                checked={selectedProducts.has(product.itemId)}
                                on:change={() => toggleProductSelection(product.itemId)}
                            />
                            {#if product.variants[0]?.images?.[0]?.url}
                                <img 
                                    src={product.variants[0].images[0].url} 
                                    alt={product.name}
                                    class="product-thumbnail"
                                />
                            {/if}
                            <div class="product-info">
                                <h3>{product.name}</h3>
                                <div class="product-badges">
                                    <span class="badge badge-{product.publicationState === 'published' ? 'green' : 'yellow'}">
                                        {product.publicationState}
                                    </span>
                                    {#if product.productInfo?.generalProductImages}
                                        <span class="badge badge-blue">Has General Image</span>
                                    {/if}
                                    {#if product.shortcuts?.length > 0}
                                        <span class="badge badge-green">Has Shortcuts</span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="sku-list">
                            {#each product.variants as variant}
                                <span class="sku-tag">{variant.sku}</span>
                            {/each}
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    {:else if $searchResults.searchTerm && !$searchResults.isLoading}
        <p class="no-results">No products found for "{$searchResults.searchTerm}"</p>
    {/if}

    {#if $searchResults.isLoading}
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Fetching all results...</p>
        </div>
    {/if}
</div>

<style>
    .search-container {
        max-width: 1200px;
        margin: 2rem auto;
        padding: 0 1rem;
    }

    .search-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .search-input {
        flex: 1;
        padding: 0.5rem 1rem;
        font-size: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
    }

    .search-input:disabled {
        background-color: #f5f5f5;
        cursor: not-allowed;
    }

    .search-button {
        padding: 0.5rem 1.5rem;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        min-width: 100px;
    }

    .search-button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    .search-button:not(:disabled):hover {
        background-color: #0056b3;
    }

    .error-message {
        padding: 1rem;
        background-color: #ffebee;
        color: #c62828;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .results-title {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .results-count {
        color: #666;
        font-size: 0.9rem;
    }

    .product-list {
        list-style: none;
        padding: 0;
        display: grid;
        gap: 1rem;
    }

    .product-item {
        padding: 1rem;
        border: 1px solid #eee;
        border-radius: 4px;
        background-color: white;
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .product-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .product-item h3 {
        margin: 0 0 0.5rem 0;
        color: #2d3748;
    }

    .sku-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .sku-tag {
        background-color: #e9ecef;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .no-results {
        text-align: center;
        color: #666;
        font-style: italic;
        margin: 2rem 0;
    }

    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 2rem 0;
        gap: 1rem;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .product-header {
        display: flex;
        gap: 1rem;
        margin-bottom: 0.5rem;
        align-items: flex-start;
    }

    .product-thumbnail {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 4px;
    }

    .product-info {
        flex: 1;
    }

    .product-badges {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.25rem;
    }

    .badge {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-weight: 500;
    }

    .badge-blue {
        background-color: #e3f2fd;
        color: #1976d2;
    }

    .badge-green {
        background-color: #e8f5e9;
        color: #2e7d32;
    }

    .badge-yellow {
        background-color: #fff3e0;
        color: #f57c00;
    }

    .search-row {
        display: flex;
        gap: 1rem;
        width: 100%;
    }

    .filters-row {
        display: flex;
        gap: 2rem;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 4px;
        flex-wrap: wrap;
    }

    .filter-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .filter-group label {
        font-size: 0.875rem;
        color: #4a5568;
        white-space: nowrap;
    }

    .filter-group select {
        padding: 0.25rem 2rem 0.25rem 0.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        font-size: 0.875rem;
        background-color: white;
        min-width: 100px;
    }

    .filter-group select:disabled {
        background-color: #f5f5f5;
        cursor: not-allowed;
    }

    .export-button {
        padding: 0.5rem 1rem;
        background-color: #4caf50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        transition: background-color 0.2s;
    }

    .export-button:hover {
        background-color: #388e3c;
    }

    .results-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .checkbox {
        width: 1.2rem;
        height: 1.2rem;
        cursor: pointer;
        border: 2px solid #e2e8f0;
        border-radius: 4px;
        accent-color: #007bff;
    }

    .selected-count {
        color: #007bff;
        font-weight: 500;
    }
</style>

