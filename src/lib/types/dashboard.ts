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

export interface SalesStats {
    today: number;
    thisWeek: number;
    thisMonth: number;
    averageOrder: number;
    topProducts: { name: string, sales: number, revenue: number }[];
    orders: { id: number, total: number }[];
    changes: {
        weekly: number;
        monthly: number;
    };
}

export interface InventoryHealth {
    lowStock: number;
    outOfStock: number;
    totalStock: number;
    reorderNeeded: ReorderItem[];
}

export interface DashboardData {
    productStats: ProductStats;
    salesStats: SalesStats;
    inventoryHealth: InventoryHealth;
}

export interface ReorderItem {
    name: string;
    current: number;
    minimum: number;
} 