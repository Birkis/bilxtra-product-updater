import type { PageServerLoad } from './$types';
import { mockDashboardData } from '$lib/mock/dashboardData';

export const load: PageServerLoad = async () => {
    // For now, we'll use the mock data
    // Later, we'll fetch this from the Crystallize API
    const { productStats } = mockDashboardData;

    // Add mock category data
    productStats.categories = [
        { name: 'Bilpleie', count: 150 },
        { name: 'Interiør', count: 85 },
        { name: 'Eksteriør', count: 120 },
        { name: 'Verktøy', count: 95 },
        { name: 'Tilbehør', count: 200 }
    ];

    // Add mock changes data
    productStats.changes = {
        total: 15, // 15% increase
        categories: {
            'Bilpleie': 8,
            'Interiør': -3,
            'Eksteriør': 12,
            'Verktøy': 5,
            'Tilbehør': 20
        }
    };

    return {
        productStats
    };
}; 