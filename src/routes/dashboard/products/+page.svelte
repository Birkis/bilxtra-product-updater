<script lang="ts">
    import type { PageData } from './$types';
    import { onMount } from 'svelte';
    import { Chart, type ChartConfiguration } from 'chart.js/auto';
    import {
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        DoughnutController,
        ArcElement
    } from 'chart.js';

    Chart.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        DoughnutController,
        ArcElement
    );
    
    export let data: PageData;
    
    let trendChart: Chart;
    let distributionChart: Chart;
    let trendChartCanvas: HTMLCanvasElement;
    let distributionChartCanvas: HTMLCanvasElement;
    
    onMount(() => {
        initializeCharts();

        return () => {
            // Cleanup charts on component destroy
            if (trendChart) {
                trendChart.destroy();
            }
            if (distributionChart) {
                distributionChart.destroy();
            }
        };
    });

    function initializeCharts() {
        // Product Trend Chart
        const trendCtx = trendChartCanvas.getContext('2d');
        if (trendCtx) {
            const trendConfig: ChartConfiguration = {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Total Products',
                        data: [580, 600, 610, 625, 635, 650],
                        borderColor: 'rgb(59, 130, 246)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Product Growth Over Time'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                        },
                    },
                    hover: {
                        mode: 'nearest',
                        intersect: true
                    }
                }
            };
            trendChart = new Chart(trendCtx, trendConfig);
        }

        // Category Distribution Chart
        const distributionCtx = distributionChartCanvas.getContext('2d');
        if (distributionCtx) {
            const categories = data.productStats.categories;
            const distributionConfig: ChartConfiguration = {
                type: 'doughnut',
                data: {
                    labels: categories.map(c => c.name),
                    datasets: [{
                        data: categories.map(c => c.count),
                        backgroundColor: [
                            'rgb(59, 130, 246)',
                            'rgb(16, 185, 129)',
                            'rgb(245, 158, 11)',
                            'rgb(239, 68, 68)',
                            'rgb(139, 92, 246)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Category Distribution'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw as number;
                                    const percentage = (value / data.productStats.total * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            };
            distributionChart = new Chart(distributionCtx, distributionConfig);
        }
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
</script>

<div class="container mx-auto px-4 py-8">
    <div class="flex items-center gap-4 mb-8">
        <a href="/dashboard" class="text-gray-600 hover:text-gray-900" aria-label="Back to dashboard">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
        </a>
        <h1 class="text-3xl font-bold">Product Analytics</h1>
    </div>

    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-700 mb-2">Total Products</h3>
            <div class="flex items-baseline gap-2">
                <p class="text-3xl font-bold text-blue-600">{formatNumber(data.productStats.total)}</p>
                {#if data.productStats.changes?.total}
                    <span class="text-sm font-medium {data.productStats.changes.total > 0 ? 'text-green-600' : 'text-red-600'}">
                        {formatPercentage(data.productStats.changes.total)}
                    </span>
                {/if}
            </div>
            <p class="text-sm text-gray-500 mt-1">Compared to last period</p>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-700 mb-2">Product Completeness</h3>
            <p class="text-3xl font-bold text-green-600">{data.productStats.completeness}%</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div class="bg-green-600 h-2.5 rounded-full" style="width: {data.productStats.completeness}%"></div>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-700 mb-2">Image Status</h3>
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">With Images</span>
                    <span class="font-medium text-green-600">{formatNumber(data.productStats.withImages)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-600">Missing Images</span>
                    <span class="font-medium text-orange-600">{formatNumber(data.productStats.withoutImages)}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-700 mb-4">Product Growth Trend</h3>
            <div class="h-80">
                <canvas bind:this={trendChartCanvas}></canvas>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-700 mb-4">Category Distribution</h3>
            <div class="h-80">
                <canvas bind:this={distributionChartCanvas}></canvas>
            </div>
        </div>
    </div>

    <!-- Category Details -->
    <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-4">Category Breakdown</h3>
        <div class="space-y-6">
            {#each data.productStats.categories as category}
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <div>
                            <span class="font-medium text-gray-900">{category.name}</span>
                            <span class="ml-2 text-sm text-gray-500">({formatNumber(category.count)} products)</span>
                        </div>
                        {#if data.productStats.changes?.categories?.[category.name]}
                            <span class="text-sm font-medium {data.productStats.changes.categories[category.name] > 0 ? 'text-green-600' : 'text-red-600'}">
                                {formatPercentage(data.productStats.changes.categories[category.name])}
                            </span>
                        {/if}
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            class="bg-blue-600 h-2 rounded-full" 
                            style="width: {(category.count / data.productStats.total * 100)}%"
                        ></div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div> 