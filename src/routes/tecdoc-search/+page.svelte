<script lang="ts">
    import { commonAssemblyGroups, brakeAssemblyGroups } from '$lib/data/tecdoc-assembly-groups';
    
    // Interface for vehicle data
    interface Vehicle {
        id: number;
        name: string;
        manufacturer: {
            id: number;
            name: string;
        };
    }

    // Interface for part data with enhanced details
    interface Part {
        id: number;
        articleNumber: string;
        brand: string;
        name: string;
        description?: string;
        genericArticleDescription?: string;
        assemblyGroup?: string;
        status: number;
        packaging: {
            unit: number;
            quantity: number;
        };
        pricing: {
            quantity: number;
            price: number;
        };
        thumbnail?: string;
        attributes?: Array<{
            name: string;
            value: string;
            displayValue?: string;
            displayUnit?: string;
        }>;
        partsList?: Array<{
            articleNumber: string;
            genericArticleId?: number;
            genericArticleDescription: string;
            quantity: number;
            criteria?: Array<any>;
        }>;
    }

    // Interface for API response
    interface ApiResponse {
        success: boolean;
        vehicle?: Vehicle;
        parts?: Part[];
        error?: string;
        totalMatchingParts?: number;
    }

    // Interface for assembly group
    interface AssemblyGroup {
        id: number;
        name: string;
        description?: string;
        parentId?: number;
        hasChildren?: boolean;
    }

    // State variables
    let licensePlate = '';
    let tecDocId = '138779'; // Default TecDoc ID for AUDI E-TRON
    let useDirectId = true; // Default to using TecDoc ID directly
    let assemblyGroupId = '100002'; // Default assembly group
    let assemblyGroupName = 'All Parts'; // Default name
    let vehicle: Vehicle | null = null;
    let parts: Part[] = [];
    let loading = false;
    let error: string | null = null;
    let totalParts = 0;
    let currentPage = 1;
    let partsPerPage = 10;
    let showAssemblyGroupDropdown = false;
    let selectedPart: Part | null = null;
    let showPartDetails = false;
    let loadingPartDetails = false;
    let partDetailsError: string | null = null;
    let useMockDataForParts = false; // New state variable for mock data toggle

    // Hardcoded license plate to avoid using credits
    const hardcodedPlate = 'EB34033';
    const hardcodedTecDocId = '138779'; // TecDoc ID for AUDI E-TRON

    // Use the imported assembly groups
    const predefinedAssemblyGroups = commonAssemblyGroups;

    // Function to search for parts by license plate or TecDoc ID
    async function searchByPlate(useHardcoded = false) {
        loading = true;
        error = null;
        vehicle = null;
        parts = [];
        
        let queryParams = '';
        
        if (useDirectId || useHardcoded) {
            // Use TecDoc ID directly
            const idToUse = useHardcoded ? hardcodedTecDocId : tecDocId;
            
            if (!idToUse) {
                error = 'Please enter a TecDoc ID';
                loading = false;
                return;
            }
            
            queryParams = `tecDocId=${encodeURIComponent(idToUse)}`;
        } else {
            // Use license plate lookup
            const plateToUse = useHardcoded ? hardcodedPlate : licensePlate;
            
            if (!plateToUse) {
                error = 'Please enter a license plate';
                loading = false;
                return;
            }
            
            queryParams = `plate=${encodeURIComponent(plateToUse)}`;
        }

        try {
            // Add assembly group and other parameters
            queryParams += `&assemblyGroupId=${encodeURIComponent(assemblyGroupId)}&includeDetails=true${useMockDataForParts ? '&useMockData=true' : ''}`;
            
            const url = `/api/tecdoc/parts-by-plate?${queryParams}`;
            const response = await fetch(url);
            const data: ApiResponse = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch data');
            }

            vehicle = data.vehicle || null;
            parts = data.parts || [];
            totalParts = data.totalMatchingParts || parts.length;
            currentPage = 1;
        } catch (err) {
            error = err instanceof Error ? err.message : 'An error occurred';
            console.error('Search error:', err);
        } finally {
            loading = false;
        }
    }

    // Function to update parts when assembly group changes
    async function updateParts() {
        if (!vehicle) return;
        
        loading = true;
        error = null;
        parts = [];
        
        try {
            const url = `/api/tecdoc/parts?vehicleId=${vehicle.id}&assemblyGroupId=${assemblyGroupId}&includeDetails=true${useMockDataForParts ? '&useMockData=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch parts');
            }
            
            parts = data.parts || [];
            totalParts = data.totalMatchingParts || parts.length;
            currentPage = 1;
        } catch (err) {
            error = err instanceof Error ? err.message : 'An error occurred';
            console.error('Parts update error:', err);
        } finally {
            loading = false;
        }
    }

    // Function to select an assembly group
    function selectAssemblyGroup(id: number, name: string) {
        assemblyGroupId = id.toString();
        assemblyGroupName = name;
        showAssemblyGroupDropdown = false;
        updateParts();
    }

    // Function to view part details
    async function viewPartDetails(part: Part) {
        selectedPart = part;
        showPartDetails = true;
        loadingPartDetails = true;
        partDetailsError = null;
        
        // If we don't have detailed information, try to fetch it
        if (!part.name || !part.description || !part.attributes || part.attributes.length === 0) {
            try {
                // Use our new dedicated article endpoint for detailed information
                const url = `/api/tecdoc/article?articleNumber=${encodeURIComponent(part.articleNumber)}&dataSupplierId=${part.id}${useMockDataForParts ? '&useMockData=true' : ''}`;
                console.log(`Fetching detailed part information from new article endpoint: ${url}`);
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.success && data.article) {
                    // Map the article data to our Part interface
                    const enhancedPart: Part = {
                        id: data.article.id || part.id,
                        articleNumber: data.article.articleNumber || part.articleNumber,
                        brand: data.article.brand || part.brand,
                        name: data.article.name || part.name,
                        description: data.article.description || part.description,
                        genericArticleDescription: data.article.genericArticleDescription || part.genericArticleDescription,
                        assemblyGroup: part.assemblyGroup, // Keep the original if available
                        status: data.article.status || part.status,
                        packaging: {
                            unit: data.article.packaging?.unit || part.packaging?.unit || 0,
                            quantity: data.article.packaging?.quantity || part.packaging?.quantity || 0
                        },
                        pricing: part.pricing || { quantity: 0, price: 0 }, // Keep the original pricing
                        thumbnail: part.thumbnail, // Keep the original thumbnail
                        attributes: data.article.criteria?.map((criteria: {
                            id: number;
                            name: string;
                            value: string;
                            formattedValue?: string;
                            unit?: string;
                        }) => ({
                            name: criteria.name,
                            value: criteria.value,
                            displayValue: criteria.formattedValue,
                            displayUnit: criteria.unit
                        })) || part.attributes || [],
                        partsList: data.article.partsList?.map((part: {
                            articleNumber: string;
                            genericArticleDescription: string;
                            quantity: number;
                        }) => ({
                            articleNumber: part.articleNumber,
                            genericArticleDescription: part.genericArticleDescription,
                            quantity: part.quantity
                        }))
                    };
                    
                    // Update the selected part with more details
                    selectedPart = enhancedPart;
                    
                    // Also update the part in the main parts array
                    const index = parts.findIndex(p => 
                        p.articleNumber === part.articleNumber && p.brand === part.brand
                    );
                    if (index !== -1) {
                        parts[index] = enhancedPart;
                        parts = [...parts]; // Trigger reactivity
                    }
                    
                    console.log('Enhanced part details from article endpoint:', selectedPart);
                } else {
                    // Fall back to the original endpoint if the new one fails
                    console.warn('New article endpoint did not return data, falling back to original endpoint');
                    await fetchPartDetailsLegacy(part);
                }
            } catch (err) {
                console.error('Failed to fetch part details from article endpoint:', err);
                partDetailsError = err instanceof Error ? err.message : 'Failed to fetch part details';
                // Try the legacy endpoint as fallback
                try {
                    await fetchPartDetailsLegacy(part);
                } catch (fallbackErr) {
                    console.error('Fallback fetch also failed:', fallbackErr);
                }
            } finally {
                loadingPartDetails = false;
            }
        } else {
            console.log('Part already has detailed information:', part);
            loadingPartDetails = false;
        }
    }
    
    // Legacy method for fetching part details as fallback
    async function fetchPartDetailsLegacy(part: Part) {
        try {
            // Construct the URL with necessary parameters
            const url = `/api/tecdoc/parts?vehicleId=${vehicle?.id}&articleNumber=${encodeURIComponent(part.articleNumber)}&brand=${encodeURIComponent(part.brand)}&includeDetails=true${useMockDataForParts ? '&useMockData=true' : ''}`;
            console.log(`Fetching detailed part information from legacy endpoint: ${url}`);
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success && data.parts && data.parts.length > 0) {
                // Update the selected part with more details
                selectedPart = data.parts[0];
                
                // Also update the part in the main parts array
                const index = parts.findIndex(p => 
                    p.articleNumber === part.articleNumber && p.brand === part.brand
                );
                if (index !== -1) {
                    parts[index] = data.parts[0];
                    parts = [...parts]; // Trigger reactivity
                }
                
                console.log('Enhanced part details from legacy endpoint:', selectedPart);
            } else {
                console.warn('No detailed information returned for part:', part.articleNumber);
            }
        } catch (err) {
            throw err; // Re-throw to be handled by the caller
        }
    }

    // Function to close part details modal
    function closePartDetails() {
        showPartDetails = false;
        selectedPart = null;
    }

    // Calculate paginated parts
    $: paginatedParts = parts.slice(
        (currentPage - 1) * partsPerPage,
        currentPage * partsPerPage
    );

    // Calculate total pages
    $: totalPages = Math.ceil(totalParts / partsPerPage);

    // Function to go to a specific page
    function goToPage(page: number) {
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
        }
    }

    // Function to format price (if available)
    function formatPrice(price: number): string {
        if (!price) return 'N/A';
        return `${price.toFixed(2)} NOK`;
    }

    // Function to get attribute display value
    function getAttributeDisplayValue(attr: { name: string; value: string; displayValue?: string; displayUnit?: string; }): string {
        if (attr.displayValue) {
            return attr.displayUnit ? `${attr.displayValue} ${attr.displayUnit}` : attr.displayValue;
        }
        return attr.displayUnit ? `${attr.value} ${attr.displayUnit}` : attr.value;
    }

    // Function to get a more descriptive part name
    function getPartDisplayName(part: Part): string {
        if (part.description) return part.description;
        if (part.genericArticleDescription) return part.genericArticleDescription;
        if (part.name) return part.name;
        return `${part.brand} ${part.articleNumber}`;
    }

    // Log out key data for this page
   $: console.log("Current Page:", currentPage);
    $: console.log("Parts Per Page:", partsPerPage);
    $: console.log("Total Parts:", totalParts);
    $: console.log("Total Pages:", totalPages);
    $: console.log("Paginated Parts:", paginatedParts);
    $: console.log("Selected Part:", selectedPart);
    $: console.log("Show Part Details:", showPartDetails);

    
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">TecDoc Parts Lookup</h1>
    
    <div class="bg-white shadow rounded-lg p-6 mb-6">
        <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h3 class="text-blue-800 font-medium">Important Information</h3>
            <p class="text-blue-700 text-sm mt-1">
                To save API credits, you can directly use TecDoc ID 138779 for AUDI E-TRON instead of license plate lookup.
                License plate lookups always use mock data to save API credits.
                Parts data will use the real API by default.
            </p>
        </div>
        
        <form on:submit|preventDefault={() => searchByPlate(false)} class="space-y-4">
            <div class="mb-4">
                <div class="flex items-center mb-2">
                    <input 
                        id="useDirectId" 
                        type="checkbox" 
                        bind:checked={useDirectId}
                        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label for="useDirectId" class="ml-2 block text-sm text-gray-700">
                        Use TecDoc ID directly (recommended to save API credits)
                    </label>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#if useDirectId}
                    <div>
                        <label for="tecDocId" class="block text-sm font-medium text-gray-700">TecDoc ID</label>
                        <input
                            id="tecDocId"
                            type="text"
                            bind:value={tecDocId}
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="e.g., 138779"
                        />
                        <p class="text-xs text-gray-500 mt-1">AUDI E-TRON ID: 138779</p>
                    </div>
                {:else}
                    <div>
                        <label for="licensePlate" class="block text-sm font-medium text-gray-700">License Plate</label>
                        <input
                            id="licensePlate"
                            type="text"
                            bind:value={licensePlate}
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="e.g., AB12345"
                        />
                        <p class="text-xs text-gray-500 mt-1">Example plate: EB34033</p>
                    </div>
                {/if}

                <div>
                    <label for="assemblyGroup" class="block text-sm font-medium text-gray-700">Assembly Group</label>
                    <div class="relative">
                        <button 
                            type="button"
                            on:click={() => showAssemblyGroupDropdown = !showAssemblyGroupDropdown}
                            class="mt-1 block w-full text-left rounded-md border border-gray-300 shadow-sm py-2 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {assemblyGroupName} (ID: {assemblyGroupId})
                        </button>
                        
                        {#if showAssemblyGroupDropdown}
                            <div class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
                                {#each predefinedAssemblyGroups as group}
                                    <button
                                        type="button"
                                        class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                        on:click={() => selectAssemblyGroup(group.id, group.name)}
                                    >
                                        {group.name} 
                                        {#if group.description}
                                            <span class="text-xs text-gray-500 block">{group.description}</span>
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="flex items-center mb-4">
                <input 
                    id="useMockData" 
                    type="checkbox" 
                    bind:checked={useMockDataForParts}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label for="useMockData" class="ml-2 block text-sm text-gray-700">
                    Use mock data for parts (saves API calls, but returns fake data)
                </label>
            </div>

            <div class="flex space-x-4">
                <button
                    type="submit"
                    disabled={loading}
                    class="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {#if loading}
                        <span class="inline-block animate-spin mr-2">⟳</span>
                        Searching...
                    {:else}
                        Search
                    {/if}
                </button>
                
                <button
                    type="button"
                    on:click={() => searchByPlate(true)}
                    disabled={loading}
                    class="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Use Hardcoded {useDirectId ? 'TecDoc ID' : 'Plate'} (AUDI E-TRON)
                </button>
            </div>
        </form>
    </div>

    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p>{error}</p>
        </div>
    {/if}

    {#if vehicle}
        <div class="bg-white shadow rounded-lg p-6 mb-6">
            <h2 class="text-xl font-semibold mb-2">Vehicle Information</h2>
            <div class="border-t pt-2">
                <p><span class="font-medium">ID:</span> {vehicle.id}</p>
                <p><span class="font-medium">Name:</span> {vehicle.name}</p>
                <p><span class="font-medium">Manufacturer:</span> {vehicle.manufacturer.name} (ID: {vehicle.manufacturer.id})</p>
            </div>
            
            <div class="mt-2 text-sm text-gray-500">
                <p>Using {useMockDataForParts ? 'mock' : 'real'} data for parts</p>
            </div>
            
            <!-- Quick Brake Parts Selection -->
            <div class="mt-4 border-t pt-4">
                <h3 class="text-lg font-medium mb-2">Quick Brake Parts Selection</h3>
                <div class="flex flex-wrap gap-2">
                    {#each brakeAssemblyGroups as group}
                        <button
                            type="button"
                            class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-sm"
                            on:click={() => selectAssemblyGroup(group.id, group.name)}
                        >
                            {group.name}
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    {/if}

    {#if parts.length > 0}
        <div class="bg-white shadow rounded-lg p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold">Compatible Parts ({totalParts})</h2>
                <div class="text-sm text-gray-500">
                    Showing {(currentPage - 1) * partsPerPage + 1} - {Math.min(currentPage * partsPerPage, parts.length)} of {parts.length} loaded parts
                    {#if totalParts > parts.length}
                        <span class="ml-1 text-blue-600">(out of {totalParts} total matching parts)</span>
                    {/if}
                </div>
            </div>

            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Article #</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each paginatedParts as part}
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{part.articleNumber}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.brand}</td>
                                <td class="px-6 py-4 text-sm text-gray-500">{part.name || 'N/A'}</td>
                                <td class="px-6 py-4 text-sm text-gray-500">
                                    {part.description || part.genericArticleDescription || 'No description available'}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatPrice(part.pricing?.price)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <button 
                                        on:click={() => viewPartDetails(part)}
                                        class="text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            {#if totalPages > 1}
                <div class="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4">
                    <div class="flex flex-1 justify-between sm:hidden">
                        <button 
                            on:click={() => goToPage(currentPage - 1)} 
                            disabled={currentPage === 1}
                            class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button 
                            on:click={() => goToPage(currentPage + 1)} 
                            disabled={currentPage === totalPages}
                            class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p class="text-sm text-gray-700">
                                Showing <span class="font-medium">{(currentPage - 1) * partsPerPage + 1}</span> to <span class="font-medium">{Math.min(currentPage * partsPerPage, parts.length)}</span> of <span class="font-medium">{parts.length}</span> loaded parts
                                {#if totalParts > parts.length}
                                    <span class="ml-1 text-blue-600">(out of {totalParts} total matching parts)</span>
                                {/if}
                            </p>
                        </div>
                        <div>
                            <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <button 
                                    on:click={() => goToPage(currentPage - 1)} 
                                    disabled={currentPage === 1}
                                    class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span class="sr-only">Previous</span>
                                    &larr;
                                </button>
                                
                                {#each Array(totalPages) as _, i}
                                    <button 
                                        on:click={() => goToPage(i + 1)} 
                                        class={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'} focus:z-20 focus:outline-offset-0`}
                                    >
                                        {i + 1}
                                    </button>
                                {/each}
                                
                                <button 
                                    on:click={() => goToPage(currentPage + 1)} 
                                    disabled={currentPage === totalPages}
                                    class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span class="sr-only">Next</span>
                                    &rarr;
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Part Details Modal -->
    {#if showPartDetails && selectedPart}
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-start">
                        <h2 class="text-xl font-bold">{getPartDisplayName(selectedPart)}</h2>
                        <button 
                            on:click={closePartDetails}
                            class="text-gray-500 hover:text-gray-700 focus:outline-none"
                        >
                            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {#if loadingPartDetails}
                        <div class="flex justify-center items-center h-64">
                            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                            <span class="ml-3 text-gray-600">Loading part details...</span>
                        </div>
                    {:else if partDetailsError}
                        <div class="bg-red-50 p-4 rounded-lg mt-4">
                            <h3 class="font-semibold text-lg text-red-700 mb-2">Error Loading Details</h3>
                            <p class="text-red-600">{partDetailsError}</p>
                            <p class="text-sm text-red-500 mt-2">
                                Unable to fetch additional information for this part. 
                                Basic information is still available below.
                            </p>
                        </div>
                        
                        <!-- Show basic info even if there was an error -->
                        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-semibold text-lg mb-2">Basic Information</h3>
                                <div class="space-y-2">
                                    <p><span class="font-medium">Article Number:</span> {selectedPart.articleNumber}</p>
                                    <p><span class="font-medium">Brand:</span> {selectedPart.brand}</p>
                                    <p><span class="font-medium">Name:</span> {selectedPart.name || 'Not available'}</p>
                                    <p><span class="font-medium">Description:</span> {selectedPart.description || 'Not available'}</p>
                                    <p><span class="font-medium">Generic Article:</span> {selectedPart.genericArticleDescription || 'Not available'}</p>
                                    <p><span class="font-medium">Assembly Group:</span> {selectedPart.assemblyGroup || 'Not available'}</p>
                                    <p><span class="font-medium">Price:</span> {formatPrice(selectedPart.pricing?.price)}</p>
                                    <p><span class="font-medium">Status:</span> {selectedPart.status || 'Unknown'}</p>
                                </div>
                                
                                {#if selectedPart.packaging}
                                    <h3 class="font-semibold text-lg mt-4 mb-2">Packaging</h3>
                                    <div class="space-y-2">
                                        <p><span class="font-medium">Unit:</span> {selectedPart.packaging.unit || 'Not specified'}</p>
                                        <p><span class="font-medium">Quantity per Unit:</span> {selectedPart.packaging.quantity || 'Not specified'}</p>
                                    </div>
                                {/if}
                            </div>
                            
                            <div>
                                {#if selectedPart.attributes && selectedPart.attributes.length > 0}
                                    <h3 class="font-semibold text-lg mb-2">Technical Specifications</h3>
                                    <div class="space-y-2">
                                        {#each selectedPart.attributes as attr}
                                            <p><span class="font-medium">{attr.name}:</span> {getAttributeDisplayValue(attr)}</p>
                                        {/each}
                                    </div>
                                {:else}
                                    <div class="bg-gray-50 p-4 rounded-lg">
                                        <h3 class="font-semibold text-lg mb-2">Technical Specifications</h3>
                                        <p class="text-gray-500">No detailed specifications available for this part.</p>
                                        <p class="text-sm text-gray-400 mt-2">
                                            The TecDoc API doesn't provide detailed information for all parts.
                                            For more information, please contact the manufacturer or check their website.
                                        </p>
                                    </div>
                                {/if}

                                <div class="mt-4 bg-blue-50 p-4 rounded-lg">
                                    <h3 class="font-semibold text-lg mb-2">Part Compatibility</h3>
                                    <p class="text-gray-700">This part is compatible with:</p>
                                    {#if vehicle}
                                        <p class="font-medium mt-2">{vehicle.name}</p>
                                        <p class="text-sm text-gray-500">Manufacturer: {vehicle.manufacturer.name}</p>
                                    {/if}
                                </div>
                                
                                <!-- Show parts list if available (from new article endpoint) -->
                                {#if selectedPart.partsList && selectedPart.partsList.length > 0}
                                    <div class="mt-4 bg-green-50 p-4 rounded-lg">
                                        <h3 class="font-semibold text-lg mb-2">Component Parts</h3>
                                        <p class="text-gray-700 mb-2">This assembly consists of the following parts:</p>
                                        <div class="max-h-60 overflow-y-auto">
                                            <table class="min-w-full divide-y divide-gray-200 text-sm">
                                                <thead class="bg-green-100">
                                                    <tr>
                                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Part Number</th>
                                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
                                                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Quantity</th>
                                                    </tr>
                                                </thead>
                                                <tbody class="bg-white divide-y divide-gray-200">
                                                    {#each selectedPart.partsList as part}
                                                        <tr class="hover:bg-gray-50">
                                                            <td class="px-3 py-2 whitespace-nowrap">{part.articleNumber}</td>
                                                            <td class="px-3 py-2">{part.genericArticleDescription || 'Unknown part'}</td>
                                                            <td class="px-3 py-2 whitespace-nowrap text-center">{part.quantity}</td>
                                                        </tr>
                                                    {/each}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-semibold text-lg mb-2">Basic Information</h3>
                                <div class="space-y-2">
                                    <p><span class="font-medium">Article Number:</span> {selectedPart.articleNumber}</p>
                                    <p><span class="font-medium">Brand:</span> {selectedPart.brand}</p>
                                    <p><span class="font-medium">Name:</span> {selectedPart.name || 'Not available'}</p>
                                    <p><span class="font-medium">Description:</span> {selectedPart.description || 'Not available'}</p>
                                    <p><span class="font-medium">Generic Article:</span> {selectedPart.genericArticleDescription || 'Not available'}</p>
                                    <p><span class="font-medium">Assembly Group:</span> {selectedPart.assemblyGroup || 'Not available'}</p>
                                    <p><span class="font-medium">Price:</span> {formatPrice(selectedPart.pricing?.price)}</p>
                                    <p><span class="font-medium">Status:</span> {selectedPart.status || 'Unknown'}</p>
                                </div>
                                
                                {#if selectedPart.packaging}
                                    <h3 class="font-semibold text-lg mt-4 mb-2">Packaging</h3>
                                    <div class="space-y-2">
                                        <p><span class="font-medium">Unit:</span> {selectedPart.packaging.unit || 'Not specified'}</p>
                                        <p><span class="font-medium">Quantity per Unit:</span> {selectedPart.packaging.quantity || 'Not specified'}</p>
                                    </div>
                                {/if}
                            </div>
                            
                            <div>
                                {#if selectedPart.attributes && selectedPart.attributes.length > 0}
                                    <h3 class="font-semibold text-lg mb-2">Technical Specifications</h3>
                                    <div class="space-y-2">
                                        {#each selectedPart.attributes as attr}
                                            <p><span class="font-medium">{attr.name}:</span> {getAttributeDisplayValue(attr)}</p>
                                        {/each}
                                    </div>
                                {:else}
                                    <div class="bg-gray-50 p-4 rounded-lg">
                                        <h3 class="font-semibold text-lg mb-2">Technical Specifications</h3>
                                        <p class="text-gray-500">No detailed specifications available for this part.</p>
                                        <p class="text-sm text-gray-400 mt-2">
                                            The TecDoc API doesn't provide detailed information for all parts.
                                            For more information, please contact the manufacturer or check their website.
                                        </p>
                                    </div>
                                {/if}

                                <div class="mt-4 bg-blue-50 p-4 rounded-lg">
                                    <h3 class="font-semibold text-lg mb-2">Part Compatibility</h3>
                                    <p class="text-gray-700">This part is compatible with:</p>
                                    {#if vehicle}
                                        <p class="font-medium mt-2">{vehicle.name}</p>
                                        <p class="text-sm text-gray-500">Manufacturer: {vehicle.manufacturer.name}</p>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}
                    
                    <div class="mt-6 flex justify-end">
                        <button 
                            on:click={closePartDetails}
                            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div> 