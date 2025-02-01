<script lang="ts">
    interface SearchQuery {
        make?: string;
        model?: string;
        productionYear?: number;
        numberOfDoors?: string;
        carVariation?: string;
        description?: string;
    }

    interface SearchResult {
        id: number;
        similarity: number;
        car_make: string;
        car_model: string;
        car_start_year: number;
        car_stop_year: number | null;
        car_description: string;
        front_rack_id: number | null;
        rear_rack_id: number | null;
    }

    let searchParams: SearchQuery = {};
    let results: SearchResult[] | null = null;
    let error: string | null = null;
    let loading = false;

    async function handleSearch() {
        loading = true;
        error = null;
        results = null;

        try {
            const response = await fetch('/api/car-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchParams)
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Search failed');
            }

            results = data.results;
        } catch (err) {
            error = err instanceof Error ? err.message : 'An error occurred';
            console.error('Search error:', err);
        } finally {
            loading = false;
        }
    }

    function formatSimilarity(similarity: number): string {
        return (similarity * 100).toFixed(1) + '%';
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Car Search</h1>
    
    <div class="bg-white shadow rounded-lg p-6 mb-6">
        <form on:submit|preventDefault={handleSearch} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="make" class="block text-sm font-medium text-gray-700">Make</label>
                    <input
                        id="make"
                        type="text"
                        bind:value={searchParams.make}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="e.g., Audi"
                    />
                </div>

                <div>
                    <label for="model" class="block text-sm font-medium text-gray-700">Model</label>
                    <input
                        id="model"
                        type="text"
                        bind:value={searchParams.model}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="e.g., e-tron"
                    />
                </div>

                <div>
                    <label for="year" class="block text-sm font-medium text-gray-700">Production Year</label>
                    <input
                        id="year"
                        type="number"
                        bind:value={searchParams.productionYear}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="e.g., 2020"
                    />
                </div>

                <div>
                    <label for="doors" class="block text-sm font-medium text-gray-700">Number of Doors</label>
                    <input
                        id="doors"
                        type="text"
                        bind:value={searchParams.numberOfDoors}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="e.g., 5-dr"
                    />
                </div>
            </div>

            <div>
                <label for="variation" class="block text-sm font-medium text-gray-700">Car Variation</label>
                <input
                    id="variation"
                    type="text"
                    bind:value={searchParams.carVariation}
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., med integrerte relinger"
                />
            </div>

            <div>
                <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                    id="description"
                    bind:value={searchParams.description}
                    rows="3"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Describe what you're looking for..."
                />
            </div>

            <div>
                <button
                    type="submit"
                    disabled={loading}
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {#if loading}
                        <span class="inline-block animate-spin mr-2">⟳</span>
                        Searching...
                    {:else}
                        Search
                    {/if}
                </button>
            </div>
        </form>
    </div>

    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {/if}

    {#if results}
        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-xl font-semibold mb-4">Search Results</h2>
            {#if results.length === 0}
                <p class="text-gray-500">No matches found.</p>
            {:else}
                <div class="space-y-4">
                    {#each results as result}
                        <div class="border rounded-lg p-4 hover:bg-gray-50">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h3 class="text-lg font-medium">
                                        {result.car_make} {result.car_model}
                                    </h3>
                                    <p class="text-sm text-gray-500">
                                        Year: {result.car_start_year}{result.car_stop_year ? ` - ${result.car_stop_year}` : ''}
                                    </p>
                                </div>
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Match: {formatSimilarity(result.similarity)}
                                </span>
                            </div>
                            <p class="mt-2 text-gray-700">{result.car_description}</p>
                            {#if result.front_rack_id || result.rear_rack_id}
                                <div class="mt-2 text-sm text-gray-600">
                                    {#if result.front_rack_id}
                                        <p>Front Rack ID: {result.front_rack_id}</p>
                                    {/if}
                                    {#if result.rear_rack_id}
                                        <p>Rear Rack ID: {result.rear_rack_id}</p>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div> 