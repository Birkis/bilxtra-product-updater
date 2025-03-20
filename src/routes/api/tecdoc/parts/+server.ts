import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TecDocService, type EnhancedArticle } from '$lib/services/TecDocService';

interface TecDocPartsResponse {
    success: boolean;
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
    totalMatchingParts: number;
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        const vehicleId = parseInt(url.searchParams.get('vehicleId') || '');
        const articleType = url.searchParams.get('articleType')?.trim();
        const assemblyGroupId = url.searchParams.get('assemblyGroupId')?.trim();
        const includeDetails = url.searchParams.get('includeDetails') === 'true';
        const articleNumber = url.searchParams.get('articleNumber')?.trim();
        const brand = url.searchParams.get('brand')?.trim();
        const useMockData = url.searchParams.get('useMockData') === 'true';
        
        if (!vehicleId && !articleNumber) {
            return json({
                success: false,
                error: 'Either Vehicle ID or Article Number is required'
            } as TecDocPartsResponse);
        }

        // Create TecDocService with mock data option for parts if requested
        // License plate lookup will always use mock data to save credits
        const tecDocService = new TecDocService({ useMockData });
        
        // If article number is provided, fetch specific part details
        if (articleNumber) {
            console.log(`Fetching details for article ${articleNumber} from brand ${brand || 'any'}`);
            
            let parts: any[] = [];
            
            if (vehicleId) {
                // First get all parts for the vehicle
                const vehicleParts = await tecDocService.getCompatibleParts(
                    vehicleId, 
                    articleType ? parseInt(articleType) : undefined,
                    assemblyGroupId ? parseInt(assemblyGroupId) : undefined
                );
                
                // Then filter by article number and brand
                parts = vehicleParts.filter(part => 
                    part.articleNumber === articleNumber && 
                    (!brand || part.mfrName === brand)
                );
            } else {
                // If no vehicle ID, try to get the part directly by article number
                const part = await tecDocService.getArticleDetailsByNumber(
                    articleNumber,
                    brand ? parseInt(brand) : 0
                );
                
                if (part) {
                    parts = [part];
                }
            }
            
            if (parts.length === 0) {
                return json({
                    success: false,
                    error: `No parts found matching article number ${articleNumber}`
                } as TecDocPartsResponse);
            }
            
            // Get enhanced details for the first matching part
            let enhancedParts = parts;
            if (includeDetails && parts.length > 0) {
                const part = parts[0];
                try {
                    console.log(`Fetching detailed information for article ${part.articleNumber} from brand ${part.mfrName || 'unknown'}`);
                    
                    const details = await tecDocService.getArticleDetailsByNumber(
                        part.articleNumber,
                        part.mfrId || 0
                    );
                    
                    if (details) {
                        enhancedParts = [{ ...part, ...details }];
                        
                        // Save the enhanced part details for debugging
                        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
                            try {
                                // Only attempt to use require in server-side environments
                                if (typeof window === 'undefined') {
                                    const fs = require('fs');
                                    const path = require('path');
                                    const debugDir = path.join(process.cwd(), 'debug');
                                    
                                    // Create debug directory if it doesn't exist
                                    if (!fs.existsSync(debugDir)) {
                                        fs.mkdirSync(debugDir, { recursive: true });
                                    }
                                    
                                    const filename = path.join(debugDir, `tecdoc-enhanced-part-${part.articleNumber}-${Date.now()}.json`);
                                    fs.writeFileSync(filename, JSON.stringify(enhancedParts[0], null, 2));
                                    console.log(`Saved enhanced part data to ${filename}`);
                                } else {
                                    console.log('Enhanced part data saving skipped in browser environment');
                                }
                            } catch (error) {
                                console.error('Failed to save enhanced part data:', error);
                            }
                        }
                    } else {
                        console.warn(`No detailed information found for part ${part.articleNumber}`);
                    }
                } catch (error) {
                    console.error(`Failed to get details for part ${part.articleNumber}:`, error);
                }
            }
            
            return json({
                success: true,
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
            } as TecDocPartsResponse);
        }
        
        // Standard parts lookup by vehicle ID
        console.log(`Fetching parts for vehicle ID ${vehicleId} with assembly group ${assemblyGroupId || 'default'}`);
        
        const parts = await tecDocService.getCompatibleParts(
            vehicleId, 
            articleType ? parseInt(articleType) : undefined,
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
        // (to avoid making too many API calls)
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

        return json({
            success: true,
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
        } as TecDocPartsResponse);

    } catch (error) {
        console.error('TecDoc parts lookup error:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process request',
            debug: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error
        } as TecDocPartsResponse, { status: 500 });
    }
}; 