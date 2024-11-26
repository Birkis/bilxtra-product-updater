<script lang="ts">
    import type { PageData } from './$types';
    import type { SKUFields, AttributeSection } from '$lib/types/sku';
    import { 
        SKU_FIELD_LABELS, 
        DIMENSION_FIELDS, 
        AI_GENERATABLE_FIELDS,
        COMMON_UNITS,
        PREDEFINED_ATTRIBUTE_SECTIONS
    } from '$lib/types/sku';
    import Papa from 'papaparse';
    
    export let data: PageData;

    let fileInput: HTMLInputElement;
    let selectedFile: File | null = null;
    let processing = false;
    let results: {
        updated: number;
        created: number;
        errors: string[];
    } | null = null;

    // CSV Preview and Mapping State
    let csvData: any[] = [];
    let csvHeaders: string[] = [];
    let columnMapping: Record<string, string> = {};
    let dimensionMapping: Record<keyof typeof DIMENSION_FIELDS, { value: string; unit: string }> = {} as any;
    let attributeSections: AttributeSection[] = [{ title: '', properties: [] }];
    let aiGenerate: Record<string, boolean> = {};
    let showMapping = false;
    let previewRows = 5;

    let selectedDimensions: Set<keyof typeof DIMENSION_FIELDS> = new Set();
    let showDimensionSelector = false;

    function initializeMappings() {
        // Initialize base mappings
        columnMapping = Object.fromEntries(
            Object.keys(SKU_FIELD_LABELS).map(field => [field, ''])
        );

        // Initialize dimension mappings
        dimensionMapping = Object.fromEntries(
            Object.keys(DIMENSION_FIELDS).map(field => [field, { value: '', unit: '' }])
        ) as typeof dimensionMapping;

        // Initialize AI generation flags
        aiGenerate = Object.fromEntries(
            AI_GENERATABLE_FIELDS.map(field => [field, false])
        );
    }

    function guessMapping() {
        csvHeaders.forEach(header => {
            const headerLower = header.toLowerCase().trim();
            
            // Try to match headers to our fields
            Object.entries(SKU_FIELD_LABELS).forEach(([field, label]) => {
                const labelText = label.replace(' (Required)', '').replace(' (Optional)', '');
                if (
                    headerLower === field.toLowerCase() ||
                    headerLower === labelText.toLowerCase()
                ) {
                    columnMapping[field] = header;
                }
            });

            // Try to match dimension fields
            Object.entries(DIMENSION_FIELDS).forEach(([field, label]) => {
                if (
                    headerLower.includes(label.toLowerCase()) ||
                    headerLower.includes(field.toLowerCase())
                ) {
                    if (headerLower.includes('unit')) {
                        dimensionMapping[field as keyof typeof DIMENSION_FIELDS].unit = header;
                    } else {
                        dimensionMapping[field as keyof typeof DIMENSION_FIELDS].value = header;
                    }
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
                preview: previewRows + 1,
                complete: (results) => {
                    csvData = results.data;
                    csvHeaders = results.meta.fields || [];
                    initializeMappings();
                    showMapping = true;
                }
            });
        }
    }

    function addAttributeSection() {
        attributeSections = [...attributeSections, { 
            title: '',
            properties: []
        }];
    }

    function addAttributeProperty(sectionIndex: number) {
        const updatedSections = [...attributeSections];
        updatedSections[sectionIndex] = {
            ...updatedSections[sectionIndex],
            properties: [
                ...updatedSections[sectionIndex].properties,
                { key: '', value: '' }
            ]
        };
        attributeSections = updatedSections;
    }

    function removeAttributeSection(index: number) {
        attributeSections = attributeSections.filter((_, i) => i !== index);
    }

    function removeAttributeProperty(sectionIndex: number, propertyIndex: number) {
        const updatedSections = [...attributeSections];
        updatedSections[sectionIndex] = {
            ...updatedSections[sectionIndex],
            properties: updatedSections[sectionIndex].properties.filter((_, i) => i !== propertyIndex)
        };
        attributeSections = updatedSections;
    }

    function toggleDimension(dimension: keyof typeof DIMENSION_FIELDS) {
        if (selectedDimensions.has(dimension)) {
            selectedDimensions.delete(dimension);
            delete dimensionMapping[dimension];
        } else {
            selectedDimensions.add(dimension);
            dimensionMapping[dimension] = { value: '', unit: '' };
        }
        selectedDimensions = selectedDimensions; // trigger reactivity
    }

    function addPredefinedSection(template: typeof PREDEFINED_ATTRIBUTE_SECTIONS[number]) {
        attributeSections = [
            ...attributeSections,
            {
                title: template.title,
                properties: template.suggestedProperties.map(prop => ({
                    key: prop,
                    value: ''
                }))
            }
        ];
    }

    async function handleSubmit() {
        console.log('handleSubmit called');
        
        if (!selectedFile) {
            console.warn('No file selected');
            return;
        }

        if (!columnMapping.sku) {
            alert('SKU field mapping is required');
            console.error('SKU field mapping is missing');
            return;
        }

        processing = true;
        results = null;
        console.log('Processing started');

        try {
            // Check for existing SKUs before processing
            const skusToCheck = csvData.map(row => row[columnMapping.sku]).filter(Boolean);
            const existingSkus = await Promise.all(
                skusToCheck.map(async (sku) => {
                    const response = await fetch(`/api/sku-exists?sku=${encodeURIComponent(sku)}`);
                    const data = await response.json();
                    return { sku, exists: data.exists };
                })
            );

            const duplicateSkus = existingSkus.filter(result => result.exists);
            if (duplicateSkus.length > 0) {
                if (!confirm(`The following SKUs already exist:\n${duplicateSkus.map(d => d.sku).join(', ')}\n\nDo you want to update them?`)) {
                    processing = false;
                    return;
                }
            }

            // Transform CSV data using the mapping and include AI generation flags
            console.log('Mapping CSV data...');
            const mappedData = csvData.map(row => {
                const mappedRow: SKUFields = {
                    sku: '',
                    aiGenerated: {},
                    dim: {},
                    produktattributer: {
                        attributer: {
                            sections: []
                        }
                    }
                };
                
                // Map basic fields
                Object.entries(columnMapping).forEach(([field, csvHeader]) => {
                    if (csvHeader) {
                        mappedRow[field] = row[csvHeader];
                    }
                });

                // Map dimensions
                Object.entries(dimensionMapping).forEach(([dim, mapping]) => {
                    if (mapping.value && mapping.unit) {
                        mappedRow.dim![dim as keyof typeof DIMENSION_FIELDS] = {
                            number: parseFloat(row[mapping.value]) || 0,
                            unit: row[mapping.unit] || mapping.unit
                        };
                    }
                });

                // Map attribute sections
                if (attributeSections.some(section => section.title && section.properties.length > 0)) {
                    mappedRow.produktattributer = {
                        attributer: {
                            sections: attributeSections
                                .filter(section => section.title && section.properties.length > 0)
                                .map(section => ({
                                    title: section.title,
                                    properties: section.properties
                                        .filter(prop => prop.key)
                                        .map(prop => ({
                                            key: prop.key,
                                            value: row[prop.value] || prop.value
                                        }))
                                }))
                        }
                    };
                }

                // Add AI generation flags
                AI_GENERATABLE_FIELDS.forEach(field => {
                    if (aiGenerate[field]) {
                        mappedRow.aiGenerated![field] = true;
                    }
                });

                return mappedRow;
            });
            console.log('CSV data mapped:', mappedData);

            const formData = new FormData();
            formData.append('mappedData', JSON.stringify(mappedData));

            console.log('Sending data to /api/sku-upload');
            const response = await fetch('/api/sku-upload', {
                method: 'POST',
                body: formData
            });
            console.log('Received response:', response);

            const result = await response.json();
            console.log('Response JSON:', result);

            if (!response.ok) {
                console.error('Upload failed:', result.error || 'Unknown error');
                throw new Error(result.error || 'Upload failed');
            }

            results = result;
            showMapping = false;

            console.log('Processing completed successfully');
            // Show success message
            const successMessage = `Successfully processed SKUs:
                - ${results.updated} SKUs updated
                - ${results.created} SKUs created
                ${results.errors.length ? `\n- ${results.errors.length} errors occurred` : ''}`;
            
            alert(successMessage);
        } catch (error) {
            console.error('Error during upload:', error);
            results = {
                updated: 0,
                created: 0,
                errors: [error instanceof Error ? error.message : 'Failed to upload file']
            };
            alert('Error processing SKUs. Please check the console for details.');
        } finally {
            processing = false;
            console.log('Processing flag set to false');
        }
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">SKU Management</h1>
    
    <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl mb-4">Upload SKUs</h2>
        
        {#if !showMapping}
            <div>
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
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium">Map CSV Columns</h3>
                    <button 
                        type="button"
                        on:click={guessMapping}
                        class="text-sm text-indigo-600 hover:text-indigo-500"
                    >
                        Auto-detect columns
                    </button>
                </div>

                <div class="grid gap-4">
                    {#each Object.entries(SKU_FIELD_LABELS) as [field, label]}
                        <div class="flex items-start space-x-4">
                            <div class="flex-grow">
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
                            
                            {#if AI_GENERATABLE_FIELDS.includes(field as any) && !columnMapping[field]}
                                <div class="flex items-center mt-8">
                                    <label class="inline-flex items-center">
                                        <input
                                            type="checkbox"
                                            bind:checked={aiGenerate[field]}
                                            class="form-checkbox h-4 w-4 text-indigo-600"
                                        >
                                        <span class="ml-2 text-sm text-gray-600">Fill with AI</span>
                                    </label>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>

                <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-2">Preview ({previewRows} rows)</h4>
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
                </div>

                <div class="mt-6 border-t pt-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Dimensions</h3>
                        <button 
                            type="button"
                            on:click={() => showDimensionSelector = !showDimensionSelector}
                            class="text-sm text-indigo-600 hover:text-indigo-500"
                        >
                            {showDimensionSelector ? 'Done' : 'Add Dimensions'}
                        </button>
                    </div>

                    {#if showDimensionSelector}
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            {#each Object.entries(DIMENSION_FIELDS) as [dim, label]}
                                <label class="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedDimensions.has(dim)}
                                        on:change={() => toggleDimension(dim)}
                                        class="form-checkbox h-4 w-4 text-indigo-600"
                                    >
                                    <span class="ml-2">{label}</span>
                                </label>
                            {/each}
                        </div>
                    {/if}

                    {#if selectedDimensions.size > 0}
                        <div class="space-y-4">
                            {#each Array.from(selectedDimensions) as dim}
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700">
                                            {DIMENSION_FIELDS[dim]} Value
                                            <select
                                                bind:value={dimensionMapping[dim].value}
                                                class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                            >
                                                <option value="">-- Select Column --</option>
                                                {#each csvHeaders as header}
                                                    <option value={header}>{header}</option>
                                                {/each}
                                            </select>
                                        </label>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700">
                                            Unit
                                            <select
                                                bind:value={dimensionMapping[dim].unit}
                                                class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                            >
                                                <option value="">-- Select Unit --</option>
                                                {#each COMMON_UNITS[dim.includes('vekt') ? 'weight' : dim.includes('volum') ? 'volume' : 'length'] as unit}
                                                    <option value={unit}>{unit}</option>
                                                {/each}
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="mt-6 border-t pt-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium">Product Attributes</h3>
                        <div class="space-x-2">
                            <button 
                                type="button"
                                on:click={addAttributeSection}
                                class="text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                Add Custom Section
                            </button>
                            <div class="relative inline-block text-left">
                                <select
                                    on:change={(e) => {
                                        const index = e.currentTarget.selectedIndex - 1;
                                        if (index >= 0) {
                                            addPredefinedSection(PREDEFINED_ATTRIBUTE_SECTIONS[index]);
                                            e.currentTarget.selectedIndex = 0;
                                        }
                                    }}
                                    class="text-sm text-indigo-600 border-none bg-transparent"
                                >
                                    <option value="">Add Predefined Section</option>
                                    {#each PREDEFINED_ATTRIBUTE_SECTIONS as template}
                                        <option value={template.title}>{template.title}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-4">
                        {#each attributeSections as section, sectionIndex}
                            <div class="border rounded-lg p-4">
                                <div class="flex justify-between items-center mb-4">
                                    <input
                                        type="text"
                                        bind:value={section.title}
                                        placeholder="Section Title"
                                        class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                    >
                                    <button
                                        type="button"
                                        on:click={() => removeAttributeSection(sectionIndex)}
                                        class="ml-2 text-red-600 hover:text-red-500"
                                    >
                                        Remove Section
                                    </button>
                                </div>

                                {#each section.properties as property, propertyIndex}
                                    <div class="grid grid-cols-2 gap-4 mb-4">
                                        <input
                                            type="text"
                                            bind:value={property.key}
                                            placeholder="Property Name"
                                            class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                        >
                                        <div class="flex">
                                            <select
                                                bind:value={property.value}
                                                class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                            >
                                                <option value="">-- Select Column --</option>
                                                {#each csvHeaders as header}
                                                    <option value={header}>{header}</option>
                                                {/each}
                                            </select>
                                            <button
                                                type="button"
                                                on:click={() => removeAttributeProperty(sectionIndex, propertyIndex)}
                                                class="ml-2 text-red-600 hover:text-red-500"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                {/each}

                                <button
                                    type="button"
                                    on:click={() => addAttributeProperty(sectionIndex)}
                                    class="text-sm text-indigo-600 hover:text-indigo-500"
                                >
                                    Add Property
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>

                <div class="mt-4 flex justify-end space-x-3">
                    <button 
                        type="button"
                        on:click={() => showMapping = false}
                        disabled={processing}
                        class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        on:click={handleSubmit}
                        disabled={!columnMapping.sku || processing}
                        class="relative px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
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
                            Upload and Process
                        {/if}
                    </button>
                </div>

                {#if results}
                    <div class="mt-6 border-t pt-4">
                        <h3 class="text-lg font-medium mb-2">Results:</h3>
                        <div class="space-y-2">
                            <div class="flex space-x-4">
                                <div class="bg-green-100 text-green-800 px-4 py-2 rounded">
                                    <span class="font-medium">Updated:</span> {results.updated}
                                </div>
                                <div class="bg-blue-100 text-blue-800 px-4 py-2 rounded">
                                    <span class="font-medium">Created:</span> {results.created}
                                </div>
                            </div>
                            {#if results.errors.length > 0}
                                <div class="bg-red-50 text-red-800 p-4 rounded">
                                    <h4 class="font-medium mb-2">Errors ({results.errors.length}):</h4>
                                    <ul class="list-disc list-inside space-y-1">
                                        {#each results.errors as error}
                                            <li>{error}</li>
                                        {/each}
                                    </ul>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>