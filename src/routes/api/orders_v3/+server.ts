import { json } from '@sveltejs/kit';
import { nextPimApi } from '$lib/crystallizeClient';

const GET_ORDERS_QUERY = `
query GET_ORDERS($min_date: DateTime, $max_date: DateTime, $after: String) {
  orders(
    first: 100
    after: $after
    filter: {
      updatedAt: {
        min: $min_date
        max: $max_date
      }
    }
    sort: {
      field: createdAt
      direction: asc
    }
  ) {
    ...on OrderConnection {
      edges {
        cursor
        node {
          id
          createdAt
          updatedAt
          total {
            gross
            net
            currency
            discounts {
              percent
            }
            tax {
              name
              percent
            }
          }
          meta {
            key
            value
          }
          additionalInformation
          customer {
            ...on Customer {
              firstName
              lastName
              email
              phone
            }
          }
          cart {
            productId
            sku
            imageUrl
            quantity
            price {
              gross
              net
              discounts {
                percent
              }
            }
            subTotal {
              gross
              net
              discounts {
                percent
              }
            }
            meta {
              key
              value
            }
          }
        }
      }
      totalCount
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
}
`;

function adjustDate(date: string, daysToSubtract: number): string {
    const adjustedDate = new Date(date);
    adjustedDate.setHours(0, 0, 0, 0);  // Start of day
    adjustedDate.setDate(adjustedDate.getDate() - daysToSubtract);
    return adjustedDate.toISOString();
}

export async function GET({ url }) {
    const minDate = url.searchParams.get('minDate');
    const maxDate = url.searchParams.get('maxDate');
    const cursor = url.searchParams.get('cursor');

    if (!minDate || !maxDate) {
        console.error('Missing date parameters');
        return json({ error: 'Missing date parameters' }, { status: 400 });
    }

    // Use a smaller buffer (2 days) for the date range
    const adjustedMinDate = adjustDate(minDate, 2);
    const adjustedMaxDate = new Date(maxDate);
    adjustedMaxDate.setHours(23, 59, 59, 999);
    adjustedMaxDate.setDate(adjustedMaxDate.getDate() + 2); // 2 day buffer at the end

    console.log('Date parameters:', {
        input: {
            minDate,
            maxDate,
            cursor
        },
        adjusted: {
            minDate: adjustedMinDate,
            maxDate: adjustedMaxDate.toISOString()
        },
        parsed: {
            originalMin: new Date(minDate).toISOString(),
            originalMax: new Date(maxDate).toISOString(),
            adjustedMin: new Date(adjustedMinDate).toISOString(),
            adjustedMax: adjustedMaxDate.toISOString()
        }
    });

    try {
        const response = await nextPimApi(GET_ORDERS_QUERY, {
            min_date: adjustedMinDate,
            max_date: adjustedMaxDate.toISOString(),
            after: cursor || null
        });

        // Enhanced logging for the response
        if (response?.orders?.edges?.length > 0) {
            const orders = response.orders.edges;
            console.log('Orders response summary:', {
                totalCount: response.orders.totalCount,
                fetchedCount: orders.length,
                dateRange: {
                    first: new Date(orders[0].node.createdAt).toISOString(),
                    last: new Date(orders[orders.length - 1].node.createdAt).toISOString()
                },
                pagination: {
                    hasNextPage: response.orders.pageInfo.hasNextPage,
                    hasPreviousPage: response.orders.pageInfo.hasPreviousPage
                },
                sampleOrder: {
                    id: orders[0].node.id,
                    createdAt: orders[0].node.createdAt,
                    meta: orders[0].node.meta
                }
            });
        }

        if (!response?.orders) {
            console.error('Invalid response structure:', response);
            return json({ error: 'Invalid response from API' }, { status: 500 });
        }

        return json({
            edges: response.orders.edges,
            totalCount: response.orders.totalCount,
            pageInfo: response.orders.pageInfo,
            dateRange: {
                minDate,
                maxDate
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        return json({ 
            error: error instanceof Error ? error.message : 'Failed to fetch orders',
            details: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
} 