/**
 * Core order types matching Crystallize API response structure
 */

/**
 * Valid meta keys as defined by Crystallize API.
 * These are the only keys that can be used for filtering orders.
 */
export type ValidMetaKey = 
    | 'order_status'
    | 'shipping_method'
    | 'cart_id'
    | 'shipping_price'
    | 'autodata_order_id'
    | 'appliedPromotions'
    | 'store_location_path'
    | 'storeLocationPath';

/**
 * Type guard to check if a string is a valid meta key
 */
export function isValidMetaKey(key: string): key is ValidMetaKey {
    const validKeys = [
        'order_status',
        'shipping_method',
        'cart_id',
        'shipping_price',
        'autodata_order_id',
        'appliedPromotions',
        'store_location_path',
        'storeLocationPath'
    ];
    return validKeys.includes(key);
}

/**
 * Basic order types
 */
export interface OrderMeta {
    key: string;
    value: string;
}

export interface OrderCustomer {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
}

export interface OrderTotal {
    gross: number;
    net: number;
    currency: string;
    tax?: {
        name: string | null;
        percent: number;
    };
    discounts?: Array<{
        percent: number;
    }>;
}

export interface CartItem {
    productId: string;
    sku: string;
    imageUrl: string | null;
    quantity: number;
    price: {
        gross: number;
        discounts?: Array<{ percent: number }>;
    };
    meta?: OrderMeta[];
}

export interface OrderNode {
    id: string;
    createdAt: string;
    updatedAt: string;
    reference: string;
    total: OrderTotal;
    customer: OrderCustomer;
    meta?: OrderMeta[];
    cart?: CartItem[];
}

/**
 * GraphQL pagination types
 */
export interface OrderEdge {
    cursor: string;
    node: OrderNode;
}

export interface PageInfo {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
}

export interface OrderConnection {
    edges: OrderEdge[];
    pageInfo: PageInfo;
    totalCount: number;
}

/**
 * UI-specific types
 */
export interface MetaKeyOption {
    value: ValidMetaKey;
    label: string;
    primary?: boolean;
    clientSide?: boolean;
    isDropdown?: boolean;
    options?: { value: string; label: string; }[];
}

export interface MetaFilter {
    key: ValidMetaKey;
    value: string;
    enabled: boolean;
    clientSide?: boolean;
}

export interface InitialFilters {
    fromDate: string;
    toDate: string;
    metaKey: ValidMetaKey;
    metaValue: string;
    pageSize: number;
}

/**
 * API request parameters
 */
export interface OrdersPageParams {
    fromDate: string | null;
    toDate: string | null;
    metaKey: ValidMetaKey;
    metaValue: string;
    cursor?: string;
    pageSize?: number;
} 