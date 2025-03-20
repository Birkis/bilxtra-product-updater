<script lang="ts">
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';

    interface MappingField {
        id: string;
        columnName: string;
        sourceField: string;
        defaultValue?: string;
    }

    interface FeedConfig {
        id: string;
        name: string;
        partner: string;
        mapping: MappingField[];
    }

    // Available Crystallize product fields for mapping
    const availableFields = [
        { value: 'name', label: 'Product Name' },
        { value: 'itemId', label: 'Product ID' },
        { value: 'variants[0].sku', label: 'SKU (First Variant)' },
        { value: 'variants[0].images[0].url', label: 'Main Image URL' },
        { value: 'productInfo.generalProductImages[0].url', label: 'General Product Image URL' },
        { value: 'publicationState', label: 'Publication State' }
    ];

    const feeds = writable<FeedConfig[]>([]);
    let newFeedName = '';
    let newFeedPartner = 'google';
    let mappingFields: MappingField[] = [];
    let isLoading = false;
    let error = '';

    // Initialize with some default mapping fields for Google
    function initializeDefaultMapping() {
        if (newFeedPartner === 'google') {
            mappingFields = [
                { id: crypto.randomUUID(), columnName: 'id', sourceField: 'itemId', defaultValue: '' },
                { id: crypto.randomUUID(), columnName: 'title', sourceField: 'name', defaultValue: '' },
                { id: crypto.randomUUID(), columnName: 'image_link', sourceField: 'variants[0].images[0].url', defaultValue: '' }
            ];
        } else {
            mappingFields = [];
        }
    }

    // Watch for partner changes to update default mapping
    $: {
        if (newFeedPartner) {
            initializeDefaultMapping();
        }
    }

    function addMappingField() {
        mappingFields = [...mappingFields, {
            id: crypto.randomUUID(),
            columnName: '',
            sourceField: availableFields[0].value,
            defaultValue: ''
        }];
    }

    function removeMappingField(id: string) {
        mappingFields = mappingFields.filter(field => field.id !== id);
    }

    async function fetchFeeds() {
        isLoading = true;
        error = '';
        try {
            const res = await fetch('/api/feeds');
            if (!res.ok) throw new Error('Failed to fetch feeds');
            const data = await res.json();
            feeds.set(data);
        } catch (e: any) {
            error = e.message || 'An error occurred while fetching feeds';
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        fetchFeeds();
        initializeDefaultMapping();
    });

    async function addFeed() {
        if (mappingFields.some(field => !field.columnName)) {
            error = 'All column names must be filled out';
            return;
        }

        isLoading = true;
        error = '';
        try {
            const res = await fetch('/api/feeds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newFeedName,
                    partner: newFeedPartner,
                    mapping: mappingFields
                })
            });

            if (!res.ok) throw new Error('Failed to create feed');
            
            await fetchFeeds();
            newFeedName = '';
            initializeDefaultMapping();
        } catch (e: any) {
            error = e.message || 'An error occurred while creating feed';
        } finally {
            isLoading = false;
        }
    }

    async function deleteFeed(id: string) {
        if (!confirm('Are you sure you want to delete this feed?')) return;

        isLoading = true;
        error = '';
        try {
            const res = await fetch(`/api/feeds?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete feed');
            await fetchFeeds();
        } catch (e: any) {
            error = e.message || 'An error occurred while deleting feed';
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">Feed Management</h1>

    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {/if}

    <div class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <h2 class="text-xl font-semibold mb-4">Create New Feed</h2>
        <form on:submit|preventDefault={addFeed} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="name">
                        Feed Name:
                    </label>
                    <input 
                        type="text" 
                        id="name"
                        bind:value={newFeedName} 
                        required
                        class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="e.g., Google Shopping Feed"
                    />
                </div>

                <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="partner">
                        Partner:
                    </label>
                    <select 
                        id="partner"
                        bind:value={newFeedPartner}
                        class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                        <option value="google">Google</option>
                        <option value="bosch">Bosch</option>
                    </select>
                </div>
            </div>

            <div class="mt-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Column Mapping</h3>
                    <button 
                        type="button"
                        on:click={addMappingField}
                        class="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                        Add Column
                    </button>
                </div>

                <div class="space-y-4">
                    {#each mappingFields as field (field.id)}
                        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start p-4 bg-gray-50 rounded">
                            <div class="md:col-span-3">
                                <label class="block text-gray-700 text-sm font-bold mb-2">
                                    Column Name
                                </label>
                                <input 
                                    type="text"
                                    bind:value={field.columnName}
                                    placeholder="e.g., title"
                                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>

                            <div class="md:col-span-4">
                                <label class="block text-gray-700 text-sm font-bold mb-2">
                                    Product Field
                                </label>
                                <select 
                                    bind:value={field.sourceField}
                                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                >
                                    {#each availableFields as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </select>
                            </div>

                            <div class="md:col-span-4">
                                <label class="block text-gray-700 text-sm font-bold mb-2">
                                    Default Value (Optional)
                                </label>
                                <input 
                                    type="text"
                                    bind:value={field.defaultValue}
                                    placeholder="Default value if field is empty"
                                    class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>

                            <div class="md:col-span-1 flex items-end justify-center h-full">
                                <button
                                    type="button"
                                    on:click={() => removeMappingField(field.id)}
                                    class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded"
                                    title="Remove mapping"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            <button 
                type="submit" 
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-6"
                disabled={isLoading}
            >
                {isLoading ? 'Creating...' : 'Create Feed'}
            </button>
        </form>
    </div>

    <div class="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <h2 class="text-xl font-semibold mb-4">Existing Feeds</h2>
        
        {#if isLoading && !$feeds.length}
            <p class="text-gray-600">Loading feeds...</p>
        {:else if !$feeds.length}
            <p class="text-gray-600">No feeds created yet.</p>
        {:else}
            <div class="overflow-x-auto">
                <table class="min-w-full table-auto">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="px-4 py-2 text-left">Name</th>
                            <th class="px-4 py-2 text-left">Partner</th>
                            <th class="px-4 py-2 text-left">Mapping</th>
                            <th class="px-4 py-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each $feeds as feed (feed.id)}
                            <tr class="border-t">
                                <td class="px-4 py-2">{feed.name}</td>
                                <td class="px-4 py-2">{feed.partner}</td>
                                <td class="px-4 py-2">
                                    <div class="space-y-1">
                                        {#each feed.mapping as field}
                                            <div class="text-sm">
                                                <span class="font-semibold">{field.columnName}</span>
                                                <span class="text-gray-500"> ← {field.sourceField}</span>
                                                {#if field.defaultValue}
                                                    <span class="text-gray-400"> (default: {field.defaultValue})</span>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </td>
                                <td class="px-4 py-2">
                                    <button
                                        on:click={() => deleteFeed(feed.id)}
                                        class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm"
                                        disabled={isLoading}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</div> 