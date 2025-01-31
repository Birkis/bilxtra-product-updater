import type { PageServerLoad } from './$types';
import { mockDashboardData } from '$lib/mock/dashboardData';

export const load: PageServerLoad = async () => {
    try {
        return {
            ...mockDashboardData
        };
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        return {
            error: 'Failed to load dashboard data'
        };
    }
}; 
