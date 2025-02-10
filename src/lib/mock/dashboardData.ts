import type { DashboardData } from '$lib/types/dashboard';

export const mockDashboardData: DashboardData = {
    productStats: {
        total: 650,
        withImages: 520,
        withoutImages: 130,
        completeness: 80,
        categories: [
            { name: 'Bilpleie', count: 150 },
            { name: 'Interiør', count: 85 },
            { name: 'Eksteriør', count: 120 },
            { name: 'Verktøy', count: 95 },
            { name: 'Tilbehør', count: 200 }
        ],
        changes: {
            total: 20,
            categories: {
                'Bilpleie': 5,
                'Interiør': 3,
                'Eksteriør': 4,
                'Verktøy': 2,
                'Tilbehør': 6
            }
        }
    },
    salesStats: {
        today: 5000,
        thisWeek: 35000,
        thisMonth: 150000,
        averageOrder: 2500,
        topProducts: [
            { name: 'Product A', sales: 3000, revenue: 15000 },
            { name: 'Product B', sales: 2000, revenue: 10000 }
        ],
        orders: [
            { id: 1, total: 2500 },
            { id: 2, total: 3000 }
        ],
        changes: {
            weekly: 200,
            monthly: 1500
        }
    },
    inventoryHealth: {
        lowStock: 25,
        outOfStock: 10,
        totalStock: 75,
        reorderNeeded: [
            { name: 'Item A', current: 5, minimum: 10 },
            { name: 'Item B', current: 3, minimum: 8 }
        ]
    }
}; 