<script lang="ts">
    let skuInput = '';
    let fileInput: HTMLInputElement;
    let isProcessing = false;
    let results: {
        message: string;
        results: {
            successful: string[];
            failed: { sku: string; error: string }[];
            notFound: string[];
        };
    } | null = null;
    let error: string | null = null;

    async function handleSubmit() {
        if (!skuInput.trim()) {
            error = 'Please enter SKUs or upload a file';
            return;
        }

        const skus = skuInput
            .split('\n')
            .map(sku => sku.trim())
            .filter(sku => sku.length > 0);

        if (skus.length === 0) {
            error = 'No valid SKUs found';
            return;
        }

        isProcessing = true;
        error = null;
        results = null;

        try {
            const response = await fetch('/api/bulk-unpublish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ skus }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            results = await response.json();
        } catch (e) {
            error = e instanceof Error ? e.message : 'An error occurred while processing the request';
        } finally {
            isProcessing = false;
        }
    }

    async function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        
        if (!file) return;

        try {
            const text = await file.text();
            skuInput = text;
        } catch (e) {
            error = 'Failed to read file';
        }
    }
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-3xl font-bold mb-6">Bulk Unpublish Products</h1>
    
    <div class="bg-white shadow-md rounded-lg p-6 mb-6">
        <div class="mb-4">
            <label for="skus" class="block text-sm font-medium text-gray-700 mb-2">
                Enter SKUs (one per line) or upload a file
            </label>
            <textarea
                id="skus"
                bind:value={skuInput}
                rows="10"
                class="w-full p-2 border rounded-md"
                placeholder="Enter SKUs here, one per line..."
            ></textarea>
        </div>

        <div class="mb-4">
            <input
                type="file"
                accept=".txt,.csv"
                bind:this={fileInput}
                on:change={handleFileUpload}
                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
        </div>

        <button
            on:click={handleSubmit}
            disabled={isProcessing}
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
            {isProcessing ? 'Processing...' : 'Unpublish Products'}
        </button>
    </div>

    {#if error}
        <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p class="text-red-700">{error}</p>
        </div>
    {/if}

    {#if results}
        <div class="bg-white shadow-md rounded-lg p-6">
            <h2 class="text-xl font-semibold mb-4">Results</h2>
            
            <div class="space-y-4">
                <div class="bg-green-50 p-4 rounded-md">
                    <h3 class="font-medium text-green-800">Successfully Unpublished ({results.results.successful.length})</h3>
                    <p class="text-sm text-green-600 mt-1">
                        {results.results.successful.join(', ')}
                    </p>
                </div>

                {#if results.results.notFound.length > 0}
                    <div class="bg-yellow-50 p-4 rounded-md">
                        <h3 class="font-medium text-yellow-800">SKUs Not Found ({results.results.notFound.length})</h3>
                        <p class="text-sm text-yellow-600 mt-1">
                            {results.results.notFound.join(', ')}
                        </p>
                    </div>
                {/if}

                {#if results.results.failed.length > 0}
                    <div class="bg-red-50 p-4 rounded-md">
                        <h3 class="font-medium text-red-800">Failed to Unpublish ({results.results.failed.length})</h3>
                        <ul class="mt-1 space-y-1">
                            {#each results.results.failed as failure}
                                <li class="text-sm text-red-600">
                                    {failure.sku}: {failure.error}
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div> 