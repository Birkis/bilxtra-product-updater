<script lang="ts">
    import { onMount } from 'svelte';
    import type { ThuleDownloadRecord } from '$lib/types';
    import { invalidateAll } from '$app/navigation';

    export let data;
    let mounted = false;
    let downloads: ThuleDownloadRecord[] = [];

    onMount(() => {
        mounted = true;
        downloads = data?.downloads || [];
    });

    let loading = {
        product: false,
        car: false
    };
    let error: string | null = null;

    async function recordDownload(record: {
        file_name: string;
        file_size: number;
        file_type: 'product' | 'car';
    }) {
        const formData = new FormData();
        formData.append('file_name', record.file_name);
        formData.append('file_size', record.file_size.toString());
        formData.append('file_type', record.file_type);

        const response = await fetch('?/recordDownload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (!result.success) {
            console.error('Error recording download:', result.error);
        } else {
            invalidateAll(); // Refresh the page data
        }
    }

    async function downloadThuleData(type: 'product' | 'car') {
        loading[type] = true;
        error = null;
        
        try {
            const response = await fetch(`/api/thule-data?type=${type}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.details || data.error);
            }

            // Handle both single file and array of files
            const files = Array.isArray(data) ? data : [data];

            for (const fileData of files) {
                if (!fileData.fileAsBase64) {
                    console.warn('Skipping file with no base64 data:', fileData.fileName);
                    continue;
                }

                try {
                    // Convert base64 to blob
                    const byteCharacters = atob(fileData.fileAsBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/octet-stream' });

                    // Create download link
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileData.fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    // Record successful download
                    await recordDownload({
                        file_name: fileData.fileName,
                        file_size: fileData.fileSizeInBytes,
                        file_type: type
                    });
                } catch (e) {
                    console.error('Error processing file:', fileData.fileName, e);
                    throw new Error(`Failed to process file: ${fileData.fileName}`);
                }
            }
        } catch (e) {
            console.error('Error downloading Thule data:', e);
            error = e instanceof Error ? e.message : 'Failed to download data';
        } finally {
            loading[type] = false;
        }
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Thule Data Download</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-xl font-semibold mb-4">Product Data</h2>
            <p class="text-gray-600 mb-4">
                Download the latest product data from Thule's master data API.
            </p>
            <button 
                on:click={() => downloadThuleData('product')}
                disabled={loading.product}
                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {#if loading.product}
                    Downloading...
                {:else}
                    Download Product Data
                {/if}
            </button>
        </div>

        <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-xl font-semibold mb-4">Car Fits Data</h2>
            <p class="text-gray-600 mb-4">
                Download the latest car fits data from Thule's master data API.
            </p>
            <button 
                on:click={() => downloadThuleData('car')}
                disabled={loading.car}
                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {#if loading.car}
                    Downloading...
                {:else}
                    Download Car Fits Data
                {/if}
            </button>
        </div>
    </div>

    {#if error}
        <div class="mt-4 p-4 bg-red-100 text-red-800 rounded">
            {error}
        </div>
    {/if}

    {#if mounted && downloads.length > 0}
        <div class="mt-8">
            <h2 class="text-xl font-semibold mb-4">Recent Downloads</h2>
            <div class="bg-white shadow rounded-lg overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                File Name
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Size
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Downloaded At
                            </th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each downloads as download}
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {download.file_name}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {download.file_type}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {Math.round(download.file_size / 1024 / 1024 * 100) / 100} MB
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {download.created_at ? new Date(download.created_at).toLocaleString() : ''}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div> 