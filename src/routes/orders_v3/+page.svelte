<script lang="ts">
    import { ordersStore, type Order } from '$lib/stores/ordersStore';
    import { onDestroy } from 'svelte';
    import Papa from 'papaparse';

    interface OrderEdge {
        cursor: string;
        node: Order;
    }

    interface OrdersResponse {
        edges: OrderEdge[];
        totalCount: number;
        pageInfo: {
            startCursor: string;
            endCursor: string;
            hasNextPage: boolean;
            hasPreviousPage: boolean;
        };
        error?: string;
    }

    let minDate = '';
    let maxDate = '';
    let isLoading = false;
    let error: string | null = null;
    let orders: Order[] = [];
    let statistics = ordersStore.statistics;
    let selectedShippingMethods = new Set<string>();

    function isWithinDateRange(date: string, minDate: string, maxDate: string): boolean {
        const orderDate = new Date(date);
        const min = new Date(minDate);
        const max = new Date(maxDate);
        
        // Set hours for precise date comparison
        orderDate.setHours(0, 0, 0, 0);
        min.setHours(0, 0, 0, 0);
        max.setHours(23, 59, 59, 999);
        
        return orderDate >= min && orderDate <= max;
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return `${month}-${day}-${year} - ${hours}:${minutes}`;
    }

    function downloadCsv() {
        if (!orders.length) return;
        downloadOrders(orders);
    }

    function downloadFilteredCsv() {
        const filteredOrders = getFilteredOrders(orders);
        if (!filteredOrders.length) return;
        downloadOrders(filteredOrders);
    }

    function downloadOrders(ordersToExport: Order[]) {
        const flattenedOrders = ordersToExport.map(order => {
            // Get shipping method and other common meta values
            const shippingMethod = order.meta.find(m => m.key === 'shipping_method')?.value || '';
            const orderStatus = order.meta.find(m => m.key === 'order_status')?.value || '';
            const storeLocation = order.meta.find(m => m.key === 'store_location_path')?.value || '';
            const appliedPromotions = order.meta.find(m => m.key === 'appliedPromotions')?.value || '';
            const autodataOrderId = order.meta.find(m => m.key === 'autodata_order_id')?.value || '';

            return {
                id: order.id,
                autodataOrderId,
                createdAt: formatDate(order.createdAt),
                updatedAt: formatDate(order.updatedAt),
                totalGross: order.total.gross,
                totalNet: order.total.net,
                currency: order.total.currency,
                customerFirstName: order.customer.firstName,
                customerLastName: order.customer.lastName,
                customerEmail: order.customer.email,
                shippingMethod,
                orderStatus,
                storeLocation,
                appliedPromotions,
                itemCount: order.cart.length,
                items: order.cart.map(item => `${item.quantity}x ${item.sku}`).join('; ')
            };
        });

        const csv = Papa.unparse(flattenedOrders, {
            quotes: true,
            header: true
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const filename = selectedShippingMethods.size > 0 
            ? `orders_${minDate}_${maxDate}_${Array.from(selectedShippingMethods).join(',')}.csv`
            : `orders_${minDate}_${maxDate}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function fetchOrders() {
        isLoading = true;
        error = null;
        ordersStore.reset();
        ordersStore.setDateRange(minDate, maxDate);
        ordersStore.setLoading(true);

        try {
            let hasMore = true;
            let cursor: string | null = null;

            while (hasMore) {
                const params: URLSearchParams = new URLSearchParams({
                    minDate,
                    maxDate,
                    ...(cursor ? { cursor } : {})
                });

                const response = await fetch(`/api/orders_v3?${params}`);
                const data = await response.json() as OrdersResponse;

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch orders');
                }

                if (cursor === null) {
                    // First page
                    ordersStore.setInitialOrders(
                        data.edges.map(edge => edge.node),
                        data.totalCount,
                        data.pageInfo.hasNextPage,
                        data.pageInfo.endCursor
                    );
                } else {
                    // Subsequent pages
                    ordersStore.appendOrders(
                        data.edges.map(edge => edge.node),
                        data.pageInfo.hasNextPage,
                        data.pageInfo.endCursor
                    );
                }

                hasMore = data.pageInfo.hasNextPage;
                cursor = data.pageInfo.endCursor;
            }
        } catch (e) {
            error = e instanceof Error ? e.message : 'An error occurred';
            ordersStore.setError(error);
        } finally {
            isLoading = false;
            ordersStore.setLoading(false);
        }
    }

    function toggleShippingMethodFilter(method: string) {
        if (selectedShippingMethods.has(method)) {
            selectedShippingMethods.delete(method);
        } else {
            selectedShippingMethods.add(method);
        }
        selectedShippingMethods = selectedShippingMethods; // trigger reactivity
    }

    function getFilteredOrders(orders: Order[]): Order[] {
        return orders.filter(order => {
            const dateMatch = isWithinDateRange(order.createdAt, minDate, maxDate);
            if (!dateMatch) return false;
            
            if (selectedShippingMethods.size > 0) {
                const orderShippingMethod = order.meta.find(m => m.key === 'shipping_method')?.value;
                return orderShippingMethod ? selectedShippingMethods.has(orderShippingMethod) : false;
            }
            
            return true;
        });
    }

    const unsubscribe = ordersStore.subscribe(state => {
        orders = state.orders;
        isLoading = state.isLoading;
        error = state.error;
    });

    onDestroy(unsubscribe);
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Orders</h1>

    <div class="mb-6">
        <div class="flex gap-4 items-end mb-4">
            <div>
                <label for="minDate" class="block text-sm font-medium text-gray-700">From Date</label>
                <input
                    type="date"
                    id="minDate"
                    bind:value={minDate}
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>
            <div>
                <label for="maxDate" class="block text-sm font-medium text-gray-700">To Date</label>
                <input
                    type="date"
                    id="maxDate"
                    bind:value={maxDate}
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>
            <button
                on:click={fetchOrders}
                disabled={isLoading || !minDate || !maxDate}
                class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
                {#if isLoading}
                    Loading...
                {:else}
                    Fetch Orders
                {/if}
            </button>
            {#if orders.length > 0}
                <button
                    on:click={downloadCsv}
                    class="px-4 py-2 border-2 border-green-600 bg-white text-green-600 rounded hover:bg-green-600 hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                    <span>Download All ({orders.length})</span>
                </button>
                <button
                    on:click={downloadFilteredCsv}
                    class="px-4 py-2 border-2 border-blue-600 bg-white text-blue-600 rounded hover:bg-blue-600 hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                    <span>Download Filtered ({getFilteredOrders(orders).length})</span>
                </button>
            {/if}
        </div>
    </div>

    {#if error}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
        </div>
    {/if}

    {#if $statistics.isComplete}
        <div class="bg-white shadow rounded-lg p-6 mb-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">Order Statistics</h2>
                {#if orders.length > 0}
                    <button
                        on:click={downloadCsv}
                        class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                        Download CSV ({orders.length} orders)
                    </button>
                {/if}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <h3 class="text-lg font-semibold mb-2">Orders</h3>
                    <p class="text-3xl font-bold">{getFilteredOrders(orders).length}</p>
                    <p class="text-sm text-gray-500">of {orders.length} total loaded</p>
                </div>
                <div>
                    <h3 class="text-lg font-semibold mb-2">Total Order Value</h3>
                    <p class="text-3xl font-bold">
                        {$statistics.currency} {$statistics.totalOrderValue.toFixed(2)}
                    </p>
                </div>
                <div>
                    <h3 class="text-lg font-semibold mb-2">Average Order Value</h3>
                    <p class="text-3xl font-bold">
                        {$statistics.currency} {$statistics.averageOrderValue.toFixed(2)}
                    </p>
                </div>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-lg font-semibold mb-2">Shipping Methods</h3>
                    <div class="flex flex-wrap gap-2">
                        {#each ['click-and-collect', 'posten', 'pick-up-in-store'] as method}
                            <button
                                class="px-3 py-1 rounded-full text-sm font-medium transition-colors
                                    {selectedShippingMethods.has(method) 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                                on:click={() => toggleShippingMethodFilter(method)}
                            >
                                {method}
                                <span class="ml-1">
                                    ({orders.filter(order => order.meta.find(m => m.key === 'shipping_method')?.value === method).length})
                                </span>
                            </button>
                        {/each}
                    </div>
                </div>

                {#if $statistics.promotions.totalOrdersWithPromotions > 0}
                    <div>
                        <h3 class="text-lg font-semibold mb-2">Promotions</h3>
                        <p class="mb-2">Orders with promotions: {$statistics.promotions.totalOrdersWithPromotions}</p>
                        <ul class="space-y-2">
                            {#each Object.entries($statistics.promotions.promotionCounts) as [promotion, count]}
                                <li class="flex justify-between">
                                    <span>{promotion}</span>
                                    <span class="font-semibold">{count}</span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    {#if orders.length > 0}
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white">
                <thead>
                    <tr>
                        <th class="px-6 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">#</th>
                        <th class="px-6 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">ORDER ID</th>
                        <th class="px-6 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">DATE</th>
                        <th class="px-6 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">CUSTOMER</th>
                        <th class="px-6 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">TOTAL</th>
                        <th class="px-6 py-3 border-b border-gray-200 bg-gray-50 text-left text-xs leading-4 font-medium text-gray-500 uppercase tracking-wider">META</th>
                    </tr>
                </thead>
                <tbody>
                    {#each getFilteredOrders(orders) as order, i}
                        <tr>
                            <td class="px-6 py-4 whitespace-no-wrap border-b border-gray-200">{i + 1}</td>
                            <td class="px-6 py-4 whitespace-no-wrap border-b border-gray-200">{order.id}</td>
                            <td class="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                            <td class="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                                {order.customer.firstName} {order.customer.lastName}
                            </td>
                            <td class="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                                {order.total.gross} {order.total.currency}
                            </td>
                            <td class="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
                                <div class="text-sm">
                                    {#each order.meta as meta}
                                        <div>
                                            <span class="font-medium">{meta.key}:</span> {meta.value}
                                        </div>
                                    {/each}
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    /* Add any custom styles here */
</style> 