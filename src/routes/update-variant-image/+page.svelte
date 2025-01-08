<script lang="ts">
    import Papa from 'papaparse';
    let fileInput: HTMLInputElement;
    let selectedFile: File | null = null;
    let csvData: any[] = [];
    let csvHeaders: string[] = [];
    let previewRows = 5;
    let showMapping = false;
    let processing = false;
    let results: {
        results?: Array<{
            productId: string;
            variantSku: string;
            status: string;
            error?: string;
            variantId?: string;
        }>;
        errors?: string[];
    } | null = null;

    // Fields we need from the CSV
    // Each field key represents what we need to run the operation.
    const REQUIRED_FIELDS = {
        productId: 'Product ID',
        productSku: 'Product SKU',
        variantSku: 'Variant SKU'
    };

    let columnMapping: Record<string, string> = {};

    function initializeMapping() {
        columnMapping = Object.fromEntries(
            Object.keys(REQUIRED_FIELDS).map(field => [field, ''])
        );
    }

    function guessMapping() {
        csvHeaders.forEach(header => {
            const headerLower = header.toLowerCase().trim();
            Object.entries(REQUIRED_FIELDS).forEach(([field, label]) => {
                const labelLower = label.toLowerCase().replace(/(required|optional)/g, '').trim();
                if (headerLower === field.toLowerCase() || headerLower === labelLower) {
                    columnMapping[field] = header;
                }
            });
        });
    }

    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input?.files?.[0];
        if (file) {
            selectedFile = file;
            Papa.parse(file, {
                header: true,
                complete: (results) => {
                    csvData = results.data;
                    csvHeaders = results.meta.fields || [];
                    initializeMapping();
                    showMapping = true;
                }
            });
        }
    }

    async function handleSubmit() {
        if (!columnMapping.productId || !columnMapping.productSku || !columnMapping.variantSku) {
            alert('Please map all required fields before proceeding.');
            return;
        }

        processing = true;
        results = null;

        try {
            // Prepare items for backend
            const items = csvData.map(row => {
                return {
                    productId: row[columnMapping.productId]?.trim(),
                    productSku: row[columnMapping.productSku]?.trim(),
                    variantSku: row[columnMapping.variantSku]?.trim()
                };
            }).filter(item => item.productId && item.productSku && item.variantSku);

            const response = await fetch('/api/update-product-variant-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });

            const result = await response.json();
            results = result;

            if (!response.ok) {
                console.error('Error updating variants:', result);
                alert(`Error: ${result.error || 'Unknown error occurred'}`);
            } else {
                console.log('Update complete:', result);
            }
        } catch (error) {
            console.error('Error during update:', error);
            results = { errors: [(error as Error).message] };
        } finally {
            processing = false;
        }
    }

    function resetPage() {
        selectedFile = null;
        csvData = [];
        csvHeaders = [];
        showMapping = false;
        processing = false;
        results = null;
        columnMapping = {};
        if (fileInput) fileInput.value = '';
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Update Variant Images from CSV</h1>

    {#if !showMapping}
        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-xl mb-4">1. Upload CSV</h2>
            <label class="block text-sm font-medium text-gray-700">
                CSV File
                <input 
                    bind:this={fileInput}
                    type="file" 
                    accept=".csv"
                    on:change={handleFileSelect}
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
            </label>
        </div>
    {/if}

    {#if showMapping}
        <div class="bg-white shadow rounded-lg p-6 mt-4 space-y-4">
            <h2 class="text-xl font-medium">2. Map CSV Columns</h2>
            <button 
                type="button"
                on:click={guessMapping}
                class="text-sm text-indigo-600 hover:text-indigo-500 mb-4"
            >
                Auto-detect columns
            </button>

            <div class="grid gap-4">
                {#each Object.entries(REQUIRED_FIELDS) as [field, label]}
                    <div>
                        <label class="block text-sm font-medium text-gray-700">
                            {label}
                            <select
                                bind:value={columnMapping[field]}
                                class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                                <option value="">-- Select Column --</option>
                                {#each csvHeaders as header}
                                    <option value={header}>{header}</option>
                                {/each}
                            </select>
                        </label>
                    </div>
                {/each}
            </div>

            <h3 class="text-lg font-medium mt-6">CSV Preview (first {previewRows} rows)</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 mt-2">
                    <thead class="bg-gray-50">
                        <tr>
                            {#each csvHeaders as header}
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {header}
                                </th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each csvData.slice(0, previewRows) as row}
                            <tr>
                                {#each csvHeaders as header}
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {row[header]}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <div class="mt-4 flex justify-end space-x-3">
                <button 
                    type="button"
                    on:click={resetPage}
                    disabled={processing}
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button 
                    type="button"
                    on:click={handleSubmit}
                    disabled={!columnMapping.productId || !columnMapping.productSku || !columnMapping.variantSku || processing}
                    class="relative px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                    {#if processing}
                        <span class="flex items-center">
                            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" 
                                    cx="12" cy="12" r="10" 
                                    stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" 
                                    fill="currentColor" 
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 
                                    1.135 5.824 3 7.938l3-2.647z">
                                </path>
                            </svg>
                            Processing...
                        </span>
                    {:else}
                        Upload and Update Variants
                    {/if}
                </button>
            </div>
        </div>
    {/if}

    {#if results && results.results}
        <div class="mt-6 bg-white shadow rounded-lg p-6">
            <h2 class="text-xl font-bold mb-4">Results</h2>
            <ul class="space-y-2">
                {#each results.results as res}
                    <li class="border-b pb-2">
                        <strong>{res.productId} / {res.variantSku}:</strong>
                        {#if res.status === 'success'}
                            <span class="text-green-600">Success (Variant ID: {res.variantId})</span>
                        {:else}
                            <span class="text-red-600">Error: {res.error}</span>
                        {/if}
                    </li>
                {/each}
            </ul>
        </div>
    {/if}

    {#if results && results.errors && results.errors.length > 0}
        <div class="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
            <h3 class="text-red-800 font-bold">Errors:</h3>
            <ul class="list-disc pl-5 text-red-800">
                {#each results.errors as error}
                    <li>{error}</li>
                {/each}
            </ul>
        </div>
    {/if}
</div>