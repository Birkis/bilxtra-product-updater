<script lang="ts">
    import type { ParseResult, ParseError } from 'papaparse';
    import Papa from 'papaparse';

    let file: File | null = null;
    let loading = false;
    let error: string | null = null;
    let stats: {
        processed: number;
        skipped: number;
        duplicates: number;
    } | null = null;

    async function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            file = input.files[0];
        }
    }

    async function processFile() {
        if (!file) {
            error = 'Please select a file first';
            return;
        }

        loading = true;
        error = null;
        stats = null;

        try {
            // Parse CSV
            const text = await file.text();
            const { data, errors } = Papa.parse(text, {
                header: true,
                skipEmptyLines: true
            }) as ParseResult<Record<string, unknown>>;

            if (errors.length > 0) {
                throw new Error(`CSV parsing errors: ${errors.map((e: ParseError) => e.message).join(', ')}`);
            }

            // Send data to server action
            const formData = new FormData();
            formData.append('csvData', JSON.stringify(data));
            
            const response = await fetch('?/importCsv', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Import failed without error details');
            }

            stats = result.stats;
        } catch (err: unknown) {
            error = err instanceof Error ? err.message : 'An error occurred while processing the file';
            console.error('Processing error:', err);
        } finally {
            loading = false;
        }
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Thule Database Management</h1>
    
    <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-4">Import CSV Data</h2>
        
        {#if error}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
                <p>{error}</p>
            </div>
        {/if}

        {#if stats}
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p class="font-semibold">Import successful!</p>
                <ul class="mt-2">
                    <li>Rows processed: {stats.processed}</li>
                    <li>Rows skipped: {stats.skipped}</li>
                    <li>Duplicates found: {stats.duplicates}</li>
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
                    on:change={handleFileUpload}
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
                disabled={loading || !file}
                class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {#if loading}
                    <span class="inline-block animate-spin mr-2">⟳</span>
                    Processing...
                {:else}
                    Process CSV File
                {/if}
            </button>
        </div>
    </div>
</div> 