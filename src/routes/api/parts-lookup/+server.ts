import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { discoveryApi } from '$lib/crystallizeClient';

interface CrystallizeProductHit {
    name: string;
    shortcuts?: string[];
    defaultVariant?: {
        sku: string;
        name: string;
        defaultPrice: number;
        defaultStock: number;
    };
}

interface CrystallizeResponse {
    browse: {
        generiskProdukt: {
            hits: CrystallizeProductHit[];
        };
    };
}

interface PartsLookupResponse {
    success: boolean;
    cartype?: string;
    compatibleParts?: Array<{
        sku: string;
        crystallizeUrl?: string;
        itemNumber?: string;
        name?: string;
        price?: number;
        stock?: number;
    }>;
    error?: string;
    debug?: any;
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        const licensePlate = url.searchParams.get('licensePlate');
        
        if (!licensePlate) {
            return json({
                success: false,
                error: 'License plate is required'
            });
        }

        console.log('Looking up license plate:', licensePlate);

        // Step 1: Get cartype from bilxtra_regnr table
        const { data: regData, error: regError } = await supabaseAdmin
            .from('bilxtra_regnr')
            .select('cartype')
            .eq('regnumber', licensePlate.toUpperCase())
            .single();

        if (regError) {
            console.error('Supabase error:', regError);
            return json({
                success: false,
                error: 'Error looking up license plate',
                debug: {
                    error: regError,
                    query: {
                        table: 'bilxtra_regnr',
                        licensePlate: licensePlate.toUpperCase()
                    }
                }
            });
        }

        if (!regData) {
            return json({
                success: false,
                error: 'No vehicle found for this license plate'
            });
        }

        const cartype = regData.cartype;
        console.log('Found cartype:', cartype);

        // Step 2: Find compatible parts from nbk_flat_data
        // Using ilike with string matching since cartype is stored as text
        const { data: partsData, error: partsError } = await supabaseAdmin
            .from('nbk_flat_data')
            .select('sku')
            .ilike('cartype', `%${cartype}%`);  // Removed limit to see all parts

        if (partsError) {
            console.error('Parts lookup error:', partsError);
            return json({
                success: false,
                error: 'Error looking up compatible parts',
                debug: {
                    error: partsError,
                    cartype
                }
            });
        }

        // Group SKUs by manufacturer prefix for analysis
        const skusByPrefix = partsData.reduce((acc: { [key: string]: string[] }, part: { sku: string }) => {
            const prefix = part.sku.split('-')[0];
            if (!acc[prefix]) {
                acc[prefix] = [];
            }
            acc[prefix].push(part.sku);
            return acc;
        }, {});

        console.log('SKUs grouped by manufacturer:', skusByPrefix);

        // Step 3: Match with Crystallize catalog
        console.log('Testing Crystallize query with exact SKU match...');
        
        const query = `
            query GET_PRODUCT_FROM_SKU($sku: String!) {
                browse {
                    generiskProdukt(
                        filters: {
                            sku: { equals: $sku }
                        }
                    ) {
                        hits {
                            name
                            shortcuts
                            defaultVariant {
                                sku
                                name
                                defaultPrice
                                defaultStock
                            }
                        }
                    }
                }
            }
        `;

        // Create a map of SKU to Crystallize product data
        const skuMap = new Map();
        
        // Query each SKU individually
        for (const part of partsData) {
            console.log('Looking up SKU in Crystallize:', part.sku);
            
            const crystallizeData = await discoveryApi<CrystallizeResponse>(query, {
                sku: part.sku
            });

            if (crystallizeData.browse.generiskProdukt.hits.length > 0) {
                const hit = crystallizeData.browse.generiskProdukt.hits[0];
                if (hit.defaultVariant?.sku) {
                    console.log('Found product:', {
                        sku: hit.defaultVariant.sku,
                        name: hit.defaultVariant.name,
                        price: hit.defaultVariant.defaultPrice,
                        stock: hit.defaultVariant.defaultStock
                    });

                    const productInfo = {
                        name: hit.defaultVariant.name,
                        price: hit.defaultVariant.defaultPrice,
                        stock: hit.defaultVariant.defaultStock,
                        url: hit.shortcuts?.[0] ? `https://bilxtra.no${hit.shortcuts[0]}` : undefined
                    };

                    skuMap.set(part.sku, productInfo);
                }
            }
        }

        const result = {
            success: true,
            cartype,
            totalCompatibleParts: partsData.length,
            skusByManufacturer: skusByPrefix,
            compatibleParts: partsData.map(part => ({
                sku: part.sku,
                ...skuMap.get(part.sku)
            }))
        };

        console.log('Final response:', JSON.stringify(result, null, 2));
        return json(result);

    } catch (error) {
        console.error('Parts lookup error:', error);
        return json({
            success: false,
            error: 'Internal server error during parts lookup',
            debug: error
        });
    }
}; 