import { writable, derived, type Readable } from 'svelte/store';

export interface OrderMeta {
    key: string;
    value: string;
}

export interface OrderTotal {
    gross: number;
    net: number;
    currency: string;
    discounts: { percent: number }[];
}

export interface OrderCustomer {
    firstName: string;
    lastName: string;
    email: string;
}

export interface OrderCartItem {
    productId: string;
    sku: string;
    quantity: number;
    price: {
        gross: number;
        net: number;
    };
}

export interface Order {
    id: string;
    createdAt: string;
    updatedAt: string;
    total: OrderTotal;
    meta: OrderMeta[];
    customer: OrderCustomer;
    cart: OrderCartItem[];
}

interface OrdersState {
    orders: Order[];
    totalCount: number;
    isLoading: boolean;
    error: string | null;
    dateRange: {
        minDate: string;
        maxDate: string;
    };
    pagination: {
        currentCursor: string | null;
        hasNextPage: boolean;
        loadedCount: number;
        isLoadingMore: boolean;
    };
}

export interface OrderStatistics {
    totalOrderValue: number;
    averageOrderValue: number;
    currency: string | null;
    shippingMethods: {
        [key: string]: number;  // method -> count
    };
    promotions: {
        totalOrdersWithPromotions: number;
        promotionCounts: {
            [key: string]: number;  // promotion -> count
        };
    };
    isComplete: boolean;
}

export interface OrdersStore extends Readable<OrdersState> {
    statistics: Readable<OrderStatistics>;
    setInitialOrders: (orders: Order[], totalCount: number, hasNextPage: boolean, endCursor: string | null) => void;
    appendOrders: (newOrders: Order[], hasNextPage: boolean, endCursor: string | null) => void;
    setDateRange: (minDate: string, maxDate: string) => void;
    setLoading: (isLoading: boolean) => void;
    setLoadingMore: (isLoadingMore: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

function isWithinDateRange(date: string, minDate: string, maxDate: string): boolean {
    const orderDate = new Date(date);
    const min = new Date(minDate);
    const max = new Date(maxDate);
    
    // Set hours for precise date comparison
    orderDate.setHours(0, 0, 0, 0);
    min.setHours(0, 0, 0, 0);
    max.setHours(23, 59, 59, 999);
    
    const isWithin = orderDate >= min && orderDate <= max;
    
    if (!isWithin) {
        console.log('Order filtered out:', {
            orderDate: orderDate.toISOString(),
            range: {
                min: min.toISOString(),
                max: max.toISOString()
            }
        });
    }
    
    return isWithin;
}

function createOrdersStore(): OrdersStore {
    const initialState: OrdersState = {
        orders: [],
        totalCount: 0,
        isLoading: false,
        error: null,
        dateRange: {
            minDate: '',
            maxDate: ''
        },
        pagination: {
            currentCursor: null,
            hasNextPage: false,
            loadedCount: 0,
            isLoadingMore: false
        }
    };

    const store = writable<OrdersState>(initialState);

    const orderStats = derived<typeof store, OrderStatistics>(store, ($store) => {
        const isComplete = $store.pagination.loadedCount === $store.totalCount && $store.totalCount > 0;
        
        if (!isComplete || $store.orders.length === 0) {
            return {
                totalOrderValue: 0,
                averageOrderValue: 0,
                currency: null,
                shippingMethods: {},
                promotions: {
                    totalOrdersWithPromotions: 0,
                    promotionCounts: {}
                },
                isComplete: false
            };
        }

        // Filter orders by creation date
        const filteredOrders = $store.orders.filter(order => 
            isWithinDateRange(order.createdAt, $store.dateRange.minDate, $store.dateRange.maxDate)
        );

        console.log('Date filtering summary:', {
            totalOrders: $store.orders.length,
            filteredOrders: filteredOrders.length,
            dateRange: {
                min: new Date($store.dateRange.minDate).toISOString(),
                max: new Date($store.dateRange.maxDate).toISOString()
            }
        });

        const stats = filteredOrders.reduce((acc, order) => {
            // Sum total values
            acc.totalOrderValue += order.total.gross;
            
            // Set currency (assuming all orders use the same currency)
            acc.currency = acc.currency || order.total.currency;

            // Count shipping methods
            const shippingMethod = order.meta?.find(m => m.key === 'shipping_method')?.value;
            if (shippingMethod) {
                acc.shippingMethods[shippingMethod] = (acc.shippingMethods[shippingMethod] || 0) + 1;
            }

            // Handle promotions
            const appliedPromotionsEntry = order.meta?.find(m => m.key === 'appliedPromotions')?.value;
            if (appliedPromotionsEntry) {
                try {
                    const promotions = JSON.parse(appliedPromotionsEntry) as string[];
                    acc.promotions.totalOrdersWithPromotions++;
                    promotions.forEach(promotion => {
                        acc.promotions.promotionCounts[promotion] = (acc.promotions.promotionCounts[promotion] || 0) + 1;
                    });
                } catch (e) {
                    console.warn('Failed to parse promotions for order:', order.id);
                }
            }

            return acc;
        }, {
            totalOrderValue: 0,
            currency: null as string | null,
            shippingMethods: {} as { [key: string]: number },
            promotions: {
                totalOrdersWithPromotions: 0,
                promotionCounts: {} as { [key: string]: number }
            }
        });

        return {
            ...stats,
            averageOrderValue: stats.totalOrderValue / filteredOrders.length,
            isComplete: true
        };
    });

    return {
        subscribe: store.subscribe,
        statistics: orderStats,
        setInitialOrders: (orders: Order[], totalCount: number, hasNextPage: boolean, endCursor: string | null) => {
            store.update(state => ({
                ...state,
                orders,
                totalCount,
                pagination: {
                    currentCursor: endCursor,
                    hasNextPage,
                    loadedCount: orders.length,
                    isLoadingMore: false
                }
            }));
        },
        appendOrders: (newOrders: Order[], hasNextPage: boolean, endCursor: string | null) => {
            store.update(state => ({
                ...state,
                orders: [...state.orders, ...newOrders],
                pagination: {
                    currentCursor: endCursor,
                    hasNextPage,
                    loadedCount: state.orders.length + newOrders.length,
                    isLoadingMore: false
                }
            }));
        },
        setDateRange: (minDate: string, maxDate: string) => {
            store.update(state => ({
                ...state,
                dateRange: { minDate, maxDate }
            }));
        },
        setLoading: (isLoading: boolean) => {
            store.update(state => ({ ...state, isLoading }));
        },
        setLoadingMore: (isLoadingMore: boolean) => {
            store.update(state => ({
                ...state,
                pagination: { ...state.pagination, isLoadingMore }
            }));
        },
        setError: (error: string | null) => {
            store.update(state => ({ ...state, error }));
        },
        reset: () => store.set(initialState)
    };
}

export const ordersStore = createOrdersStore(); 