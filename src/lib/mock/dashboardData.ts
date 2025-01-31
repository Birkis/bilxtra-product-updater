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
        ]
    },
    salesStats: {
        total: 125000,
        average: 2500,
        period: 'last_7_days'
    },
    inventoryHealth: {
        lowStock: 25,
        outOfStock: 10,
        overstock: 15
    }
}; 