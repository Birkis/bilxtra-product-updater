export interface ProductStats {
    total: number;
    withImages: number;
    withoutImages: number;
    completeness: number;
    categories: CategoryStat[];
    changes?: {
        total: number;
        categories: {
            [key: string]: number;
        };
    };
}

export interface CategoryStat {
    name: string;
    count: number;
}

export interface DashboardData {
    productStats: ProductStats;
    salesStats: {
    total: number;
        average: number;
    period: string;
    };
    inventoryHealth: {
    lowStock: number;
    outOfStock: number;
    overstock: number;
    };
} 