<script lang="ts">
    import type { DashboardData, ProductStats, SalesStats, InventoryHealth, ReorderItem } from '$lib/types/dashboard';
    import { goto } from '$app/navigation';
    
    export let data: DashboardData & { error?: string };
    
    // Time period selection
    const periods = {
        '7d': 'Last 7 dager',
        '30d': 'Last 30 dager',
        '1y': 'I år'
    };
    let selectedPeriod: '7d' | '30d' | '1y' = '7d';
    
    // Use server data or fallback to empty values
    $: productStats = data.productStats || ({
        total: 0,
        withImages: 0,
        withoutImages: 0,
        completeness: 0,
        categories: [],
        changes: {
            total: 0,
            categories: {}
        }
    } as ProductStats);
    
    $: salesStats = data.salesStats || ({
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        averageOrder: 0,
        topProducts: [],
        orders: [],
        changes: {
            weekly: 0,
            monthly: 0
        }
    } as SalesStats);
    
    $: inventoryHealth = data.inventoryHealth || ({
        lowStock: 0,
        outOfStock: 0,
        totalStock: 0,
        reorderNeeded: []
    } as InventoryHealth);
    
    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat('nb-NO', {
            style: 'currency',
            currency: 'NOK'
        }).format(amount);
    }
    
    function formatNumber(num: number): string {
        return new Intl.NumberFormat('nb-NO').format(num);
    }
    
    function formatPercentage(value: number): string {
        const formatted = new Intl.NumberFormat('nb-NO', {
            style: 'percent',
            signDisplay: 'exceptZero',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(value / 100);
        return formatted;
    }
    
    function navigateToDetail(section: string) {
        goto(`/dashboard/${section}`);
    }
    
    function selectPeriod(key: string): void {
        selectedPeriod = key as '7d' | '30d' | '1y';
    }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold">E-commerce Dashboard</h1>
        <div class="flex gap-4">
            {#each Object.entries(periods) as [key, label]}
                <button 
                    class={`px-4 py-2 rounded transition-colors duration-200 ${selectedPeriod === key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    on:click={() => selectPeriod(key)}
                >
                    {label}
                </button>
            {/each}
        </div>
    </div>
    
    {#if data.error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <p class="font-bold">Error</p>
            <p>{data.error}</p>
        </div>
    {:else}
        <!-- Product Analytics -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <!-- Total Products -->
            <div 
                class="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200"
                on:click={() => navigateToDetail('products')}
                role="button"
                tabindex="0"
                aria-label="View product details"
            >
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-700">Total Products</h3>
                        <div class="flex items-baseline gap-2 mt-2">
                            <p class="text-3xl font-bold text-blue-600">{formatNumber(productStats.total)}</p>
                            {#if productStats.changes?.total}
                                <span class="text-sm font-medium {productStats.changes.total > 0 ? 'text-green-600' : 'text-red-600'}">
                                    {formatPercentage(productStats.changes.total)}
                                </span>
                            {/if}
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-sm font-medium text-gray-600">Completeness</span>
                        <p class="text-2xl font-bold text-green-600">{productStats.completeness}%</p>
                    </div>
                </div>

                <div class="mb-6">
                    <div class="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Product Images</span>
                        <span>{formatNumber(productStats.withImages)} / {formatNumber(productStats.total)}</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                        <div class="bg-green-600 h-2 rounded-full" style="width: {productStats.completeness}%"></div>
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="text-sm text-gray-500">Product Categories</div>
                    {#each productStats.categories as category}
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">{category.name}</span>
                            <div class="flex items-center gap-2">
                                <span class="font-medium">{formatNumber(category.count)}</span>
                                {#if productStats.changes?.categories?.[category.name]}
                                    <span class="text-xs {productStats.changes.categories[category.name] > 0 ? 'text-green-600' : 'text-red-600'}">
                                        {formatPercentage(productStats.changes.categories[category.name])}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="mt-4 text-sm text-blue-600 flex items-center">
                    <span>View details</span>
                    <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
            
            <!-- Sales Overview -->
            <div 
                class="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200"
                on:click={() => navigateToDetail('sales')}
                role="button"
                tabindex="0"
                aria-label="View sales details"
            >
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-lg font-semibold text-gray-700">Sales Overview</h3>
                    {#if salesStats.changes?.weekly}
                        <span class="text-sm font-medium {salesStats.changes.weekly > 0 ? 'text-green-600' : 'text-red-600'}">
                            {formatPercentage(salesStats.changes.weekly)}
                        </span>
                    {/if}
                </div>
                <p class="text-3xl font-bold text-purple-600">{formatCurrency(salesStats.thisMonth)}</p>
                <div class="mt-4 space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Today</span>
                        <span class="font-medium">{formatCurrency(salesStats.today)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">This Week</span>
                        <span class="font-medium">{formatCurrency(salesStats.thisWeek)}</span>
                    </div>
                    <div class="flex justify-between border-t pt-2">
                        <span class="text-gray-600">Avg. Order</span>
                        <span class="font-medium">{formatCurrency(salesStats.averageOrder)}</span>
                    </div>
                </div>
                <div class="mt-4 text-sm text-blue-600 flex items-center">
                    <span>View details</span>
                    <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
            
            <!-- Inventory Health -->
            <div 
                class="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200"
                on:click={() => navigateToDetail('inventory')}
                role="button"
                tabindex="0"
                aria-label="View inventory details"
            >
                <h3 class="text-lg font-semibold text-gray-700 mb-2">Inventory Health</h3>
                <p class="text-3xl font-bold text-red-600">{inventoryHealth.outOfStock}</p>
                <p class="text-sm text-gray-500">Products Out of Stock</p>
                <div class="mt-4 space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Low Stock</span>
                        <span class="font-medium text-orange-600">{formatNumber(inventoryHealth.lowStock)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Total Stock Value</span>
                        <span class="font-medium">{formatCurrency(inventoryHealth.totalStock)}</span>
                    </div>
                </div>
                <div class="mt-4 text-sm text-blue-600 flex items-center">
                    <span>View details</span>
                    <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </div>
        
        <!-- Detailed Sections -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Top Selling Products -->
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Top Selling Products</h3>
                <div class="space-y-4">
                    {#each salesStats.topProducts as product}
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-medium">{product.name}</p>
                                <p class="text-sm text-gray-500">{product.sales} units sold</p>
                            </div>
                            <span class="text-lg font-semibold">{formatCurrency(product.revenue)}</span>
                        </div>
                    {/each}
                </div>
            </div>
            
            <!-- Products Needing Reorder -->
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Reorder Needed</h3>
                <div class="space-y-4">
                    {#each inventoryHealth.reorderNeeded as product}
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-medium">{product.name}</p>
                                <p class="text-sm text-gray-500">Current stock: {product.current}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-medium text-red-600">Below minimum</p>
                                <p class="text-sm text-gray-500">Minimum: {product.minimum}</p>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div> 