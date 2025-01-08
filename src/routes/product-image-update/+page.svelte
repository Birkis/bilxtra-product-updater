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
        updated: number;
        skipped: number;
        errors: Array<{
            itemId: string;
            sku: string;
            error: string;
        }>;
    } | null = null;

    // Required fields from CSV
    const REQUIRED_FIELDS = {
        itemId: 'Item ID',
        sku: 'SKU'
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
                    guessMapping();
                    showMapping = true;
                }
            });
        }
    }

    async function handleSubmit() {
        if (!columnMapping.itemId || !columnMapping.sku) {
            alert('Please map all required fields before proceeding.');
            return;
        }

        processing = true;
        results = null;

        try {
            const items = csvData
                .map(row => ({
                    itemId: row[columnMapping.itemId]?.trim(),
                    sku: row[columnMapping.sku]?.trim()
                }))
                .filter(item => item.itemId && item.sku);

            const response = await fetch('/api/product-image-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            results = await response.json();
        } catch (error) {
            console.error('Error during update:', error);
            results = {
                updated: 0,
                skipped: 0,
                errors: [{
                    itemId: 'N/A',
                    sku: 'N/A',
                    error: error instanceof Error ? error.message : 'Unknown error occurred'
                }]
            };
        } finally {
            processing = false;
        }
    }

    function downloadResults() {
        if (!results) return;

        const rows = [
            ['Item ID', 'SKU', 'Status', 'Error']
        ];

        // Add successful updates
        for (let i = 0; i < results.updated; i++) {
            rows.push(['Success', '', '', '']);
        }

        // Add skipped items
        for (let i = 0; i < results.skipped; i++) {
            rows.push(['Skipped', '', '', '']);
        }

        // Add errors
        results.errors.forEach(error => {
            rows.push([error.itemId, error.sku, 'Error', error.error]);
        });

        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `product-image-update-results-${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function resetPage() {
        selectedFile = null;
        csvData = [];
        csvHeaders = [];
        showMapping = false;
        processing = false;
        results = null;
        if (fileInput) fileInput.value = '';
        initializeMapping();
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Update Product Images</h1>
    <p class="text-gray-600 mb-6">Upload a CSV file containing product Item IDs and SKUs to update variant images with product-level images.</p>

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
        <div class="bg-white shadow rounded-lg p-6 mt-4">
            <h2 class="text-xl font-medium mb-4">2. Map CSV Columns</h2>
            
            <div class="grid gap-4 mb-6">
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

            <h3 class="text-lg font-medium mb-2">CSV Preview (first {previewRows} rows)</h3>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
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

            <div class="mt-6 flex justify-end space-x-3">
                <button 
                    type="button"
                    on:click={resetPage}
                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Start Over
                </button>
                <button 
                    type="button"
                    on:click={handleSubmit}
                    disabled={!columnMapping.itemId || !columnMapping.sku || processing}
                    class="relative px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {#if processing}
                        <span class="flex items-center">
                            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </span>
                    {:else}
                        Process Updates
                    {/if}
                </button>
            </div>
        </div>
    {/if}

    {#if results}
        <div class="bg-white shadow rounded-lg p-6 mt-4">
            <h2 class="text-xl font-medium mb-4">Results</h2>
            <div class="space-y-4">
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-green-50 p-4 rounded-lg">
                        <p class="text-green-800 font-medium">Updated</p>
                        <p class="text-2xl font-bold text-green-600">{results.updated}</p>
                    </div>
                    <div class="bg-yellow-50 p-4 rounded-lg">
                        <p class="text-yellow-800 font-medium">Skipped</p>
                        <p class="text-2xl font-bold text-yellow-600">{results.skipped}</p>
                    </div>
                    <div class="bg-red-50 p-4 rounded-lg">
                        <p class="text-red-800 font-medium">Errors</p>
                        <p class="text-2xl font-bold text-red-600">{results.errors.length}</p>
                    </div>
                </div>

                {#if results.errors.length > 0}
                    <div class="mt-4">
                        <h3 class="text-lg font-medium mb-2">Error Details</h3>
                        <div class="bg-red-50 p-4 rounded-lg">
                            <ul class="list-disc list-inside space-y-2">
                                {#each results.errors as error}
                                    <li class="text-red-700">
                                        Item ID: {error.itemId}, SKU: {error.sku} - {error.error}
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </div>
                {/if}

                <div class="mt-4 flex justify-end">
                    <button
                        on:click={downloadResults}
                        class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        Download Results
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div> 