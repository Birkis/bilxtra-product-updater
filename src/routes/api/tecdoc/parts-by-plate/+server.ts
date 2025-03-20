import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TecDocService, type EnhancedArticle } from '$lib/services/TecDocService';

interface TecDocPartsByPlateResponse {
    success: boolean;
    vehicle?: {
        id: number;
        name: string;
        manufacturer: {
            id: number;
            name: string;
        };
    };
    parts?: Array<{
        id: number;
        articleNumber: string;
        brand: string;
        name: string;
        description?: string;
        genericArticleDescription?: string;
        assemblyGroup?: string;
        status: number;
        packaging: {
            unit: number;
            quantity: number;
        };
        pricing: {
            quantity: number;
            price: number;
        };
        thumbnail?: string;
        attributes?: Array<{
            name: string;
            value: string;
            displayValue?: string;
            displayUnit?: string;
        }>;
    }>;
    error?: string;
    debug?: any;
    totalMatchingParts?: number;
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        const plate = url.searchParams.get('plate')?.trim();
        const tecDocId = url.searchParams.get('tecDocId')?.trim();
        const assemblyGroupId = url.searchParams.get('assemblyGroupId')?.trim();
        const includeDetails = url.searchParams.get('includeDetails') === 'true';
        const useMockData = url.searchParams.get('useMockData') === 'true';
        
        // Check if we have either a plate or a tecDocId
        if (!plate && !tecDocId) {
            return json({
                success: false,
                error: 'Either license plate or TecDoc ID is required'
            });
        }

        // Create TecDocService with mock data option for parts
        const tecDocService = new TecDocService({ useMockData });
        
        let vehicleId: number;
        let vehicleData: any;
        
        // If tecDocId is provided, use it directly
        if (tecDocId) {
            vehicleId = parseInt(tecDocId);
            
            // For the AUDI E-TRON with ID 138779, use hardcoded data
            if (vehicleId === 138779) {
                vehicleData = {
                    carId: 138779,
                    carName: "AUDI E-TRON (GEN) 50 quattro",
                    country: "NO",
                    linkingTargetType: "P",
                    subLinkageTargetType: "V",
                    manuId: 5,
                    modelId: 39213
                };
            } else {
                // For other vehicle IDs, we would need to fetch the vehicle data
                // This is just a placeholder - in a real implementation, you would fetch the vehicle data
                vehicleData = {
                    carId: vehicleId,
                    carName: "Unknown Vehicle",
                    country: "NO",
                    linkingTargetType: "P",
                    subLinkageTargetType: "V",
                    manuId: 0,
                    modelId: 0
                };
            }
        } else {
            // Get vehicle by license plate (will use mock data for EB34033)
            const vehicleResponse = await tecDocService.getVehicleByLicensePlate(plate!);
            
            if (!vehicleResponse.data?.array || vehicleResponse.data.array.length === 0) {
                return json({
                    success: false,
                    error: `No vehicle found with license plate ${plate}`
                });
            }
            
            vehicleData = vehicleResponse.data.array[0];
            vehicleId = vehicleData.carId;
        }
        
        console.log(`Using vehicle with ID ${vehicleId}`);
        
        // Get parts for the vehicle (will use real API unless useMockData is true)
        const parts = await tecDocService.getCompatibleParts(
            vehicleId, 
            undefined,
            assemblyGroupId ? parseInt(assemblyGroupId) : undefined
        );
        
        console.log(`Found ${parts.length} parts for vehicle ${vehicleId}`);
        
        // Sort parts by brand and article number to avoid always getting the same parts first
        const sortedParts = [...parts].sort((a, b) => {
            // First sort by brand name
            if (a.mfrName && b.mfrName) {
                const brandCompare = a.mfrName.localeCompare(b.mfrName);
                if (brandCompare !== 0) return brandCompare;
            }
            // Then by article number
            return a.articleNumber.localeCompare(b.articleNumber);
        });
        
        // If detailed information is requested, fetch it for the first 10 parts
        let enhancedParts: (EnhancedArticle | any)[] = sortedParts;
        if (includeDetails && sortedParts.length > 0) {
            const detailsLimit = Math.min(sortedParts.length, 10);
            console.log(`Fetching detailed information for ${detailsLimit} parts`);
            
            const enhancedPartsPromises = sortedParts.slice(0, detailsLimit).map(async (part) => {
                if (part.dataSupplierId && part.articleNumber) {
                    try {
                        const details = await tecDocService.getArticleDetailsByNumber(
                            part.articleNumber,
                            part.mfrId || 0
                        );
                        return details ? { ...part, ...details } : part;
                    } catch (error) {
                        console.error(`Failed to get details for part ${part.articleNumber}:`, error);
                        return part;
                    }
                }
                return part;
            });
            
            const detailedParts = await Promise.all(enhancedPartsPromises);
            enhancedParts = [...detailedParts, ...sortedParts.slice(detailsLimit)];
        }
        
        // Return the response
        return json({
            success: true,
            vehicle: {
                id: vehicleData.carId,
                name: vehicleData.carName,
                manufacturer: {
                    id: vehicleData.manuId,
                    name: vehicleData.carName.split(' ')[0] // Extract manufacturer name from car name
                }
            },
            parts: enhancedParts.map(part => ({
                id: part.dataSupplierId || 0,
                articleNumber: part.articleNumber || '',
                brand: part.mfrName || '',
                name: part.genericArticleName || '',
                description: part.description || '',
                genericArticleDescription: part.genericArticleDescription || '',
                assemblyGroup: part.assemblyGroup || '',
                status: part.articleStatusId || 0,
                packaging: {
                    unit: part.packingUnit || 0,
                    quantity: part.quantityPerPackingUnit || 0
                },
                pricing: {
                    quantity: part.immediateDisplayQuantity || 0,
                    price: part.immediateDisplayPrice || 0
                },
                thumbnail: part.thumbnailName || '',
                attributes: part.attributes?.map((attr: { attrName: string; attrValue: string; displayValue?: string; displayUnit?: string; }) => ({
                    name: attr.attrName,
                    value: attr.attrValue,
                    displayValue: attr.displayValue,
                    displayUnit: attr.displayUnit
                })) || []
            })),
            totalMatchingParts: tecDocService.lastTotalMatchingArticles || enhancedParts.length
        });
    } catch (error) {
        console.error('TecDoc parts-by-plate lookup error:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process request',
            debug: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error
        }, { status: 500 });
    }
}; 