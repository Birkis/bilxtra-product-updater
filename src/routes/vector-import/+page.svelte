<script lang="ts">
    import Papa from 'papaparse';
    
    let fileInput: HTMLInputElement;
    let selectedFile: File | null = null;
    let processing = false;
    let error: string | null = null;
    let results: {
        processed: number;
        skipped: number;
        errors: string[];
    } | null = null;

    async function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            selectedFile = input.files[0];
        }
    }

    async function processFile() {
        if (!selectedFile) {
            error = 'Please select a file first';
            return;
        }

        processing = true;
        error = null;
        results = null;

        try {
            // Parse CSV
            const text = await selectedFile.text();
            const { data, errors: parseErrors } = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            });

            if (parseErrors.length > 0) {
                throw new Error(`CSV parsing errors: ${parseErrors.map(e => e.message).join(', ')}`);
            }

            // Send data to server
            const response = await fetch('/api/vector-import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ csvData: data })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Import failed without error details');
            }

            results = result.results;
        } catch (err) {
            error = err instanceof Error ? err.message : 'An error occurred while processing the file';
            console.error('Processing error:', err);
        } finally {
            processing = false;
        }
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Vector Database Import</h1>
    
    <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl mb-4">Import CSV Data to Vector Database</h2>
        
        {#if error}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                <p>{error}</p>
            </div>
        {/if}

        {#if results}
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p class="font-semibold">Import successful!</p>
                <ul class="mt-2">
                    <li>Rows processed: {results.processed}</li>
                    <li>Rows skipped: {results.skipped}</li>
                    {#if results.errors.length > 0}
                        <li class="text-red-600">Errors: {results.errors.length}</li>
                        <ul class="ml-4">
                            {#each results.errors as error}
                                <li class="text-sm">{error}</li>
                            {/each}
                        </ul>
                    {/if}
                </ul>
            </div>
        {/if}

        <div class="flex flex-col gap-4">
            <div>
                <label for="csv-file" class="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV File
                </label>
                <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    on:change={handleFileSelect}
                    class="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                />
            </div>

            <button
                on:click={processFile}
                disabled={processing || !selectedFile}
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if processing}
                    <span class="inline-block animate-spin mr-2">⟳</span>
                    Processing...
                {:else}
                    Process CSV File
                {/if}
            </button>
        </div>
    </div>
</div> 