import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TecDocService } from '$lib/services/TecDocService';

interface TecDocArticleResponse {
    success: boolean;
    article?: {
        id: number;
        articleNumber: string;
        brand: string;
        mfrId: number;
        name: string;
        description?: string;
        genericArticleDescription?: string;
        status: number;
        statusDescription?: string;
        packaging: {
            unit: number;
            quantity: number;
        };
        images: Array<{
            url: string;
            type: string;
            sortOrder: number;
        }>;
        criteria: Array<{
            id: number;
            name: string;
            value: string;
            formattedValue?: string;
            unit?: string;
        }>;
        partsList?: Array<{
            articleNumber: string;
            genericArticleId: number;
            genericArticleDescription: string;
            quantity: number;
            criteria?: Array<any>;
        }>;
        oemNumbers?: string[];
        gtin?: string[];
    };
    error?: string;
    debug?: any;
    rawResponse?: any;
}

// New endpoint to get detailed article information
export const GET: RequestHandler = async ({ url }) => {
    try {
        // Parse request parameters
        const articleNumber = url.searchParams.get('articleNumber')?.trim();
        const dataSupplierId = parseInt(url.searchParams.get('dataSupplierId') || '0');
        const saveRawResponse = url.searchParams.get('saveRawResponse') === 'true';
        const useMockData = url.searchParams.get('useMockData') === 'true';
        
        if (!articleNumber) {
            return json({
                success: false,
                error: 'Article Number is required'
            } as TecDocArticleResponse);
        }

        // Create TecDocService
        const tecDocService = new TecDocService({ useMockData });
        
        console.log(`Fetching detailed information for article ${articleNumber} with supplier ID ${dataSupplierId || 'any'}`);
        
        // Make the API request using the getArticles method as shown in Postman collection
        const response = await tecDocService.makeCustomRequest('getArticles', {
            lang: 'no',
            articleCountry: 'NO',
            searchType: 0,
            searchQuery: articleNumber,
            dataSupplierIds: dataSupplierId || undefined,
            includeAll: true,
            perPage: 10
        });
        
        // Log response for debugging
        console.log(`Received API response for article ${articleNumber}:`, { 
            status: response.status,
            totalArticles: response.totalMatchingArticles,
            articlesFound: response.articles?.length || 0
        });
        
        if (!response.articles || response.articles.length === 0) {
            return json({
                success: false,
                error: `No article found matching article number ${articleNumber}`
            } as TecDocArticleResponse);
        }
        
        // Process the first matching article
        const article = response.articles[0];
        
        // Format the response
        const formattedResponse: TecDocArticleResponse = {
            success: true,
            article: {
                id: article.dataSupplierId || 0,
                articleNumber: article.articleNumber || articleNumber,
                brand: article.mfrName || '',
                mfrId: article.mfrId || 0,
                name: article.genericArticles?.[0]?.genericArticleDescription || '',
                description: article.articleText?.join(' ') || '',
                genericArticleDescription: article.genericArticles?.[0]?.genericArticleDescription || '',
                status: article.misc?.articleStatusId || 0,
                statusDescription: article.misc?.articleStatusDescription || '',
                packaging: {
                    unit: article.misc?.quantityPerPackage || 0,
                    quantity: article.misc?.quantityPerPartPerPackage || 0
                },
                images: (article.images || []).map((img: any) => ({
                    url: img.imageURL400 || img.imageURL200 || img.imageURL100 || '',
                    type: img.typeDescription || '',
                    sortOrder: img.sortNumber || 0
                })),
                criteria: (article.articleCriteria || []).map((criteria: any) => ({
                    id: criteria.criteriaId || 0,
                    name: criteria.criteriaDescription || '',
                    value: criteria.rawValue || '',
                    formattedValue: criteria.formattedValue || '',
                    unit: criteria.criteriaUnitDescription || ''
                })),
                partsList: (article.partsList || []).map((part: any) => ({
                    articleNumber: part.articleNumber || '',
                    genericArticleId: part.genericArticleId || 0,
                    genericArticleDescription: part.genericArticleDescription || '',
                    quantity: part.quantity || 0,
                    criteria: part.criteria || []
                })),
                oemNumbers: (article.oemNumbers || []).map((oem: any) => oem.articleNumber || ''),
                gtin: article.gtins || []
            }
        };
        
        // Include raw response for debugging if requested
        if (saveRawResponse) {
            formattedResponse.rawResponse = response;
            
            // Save to file if in development
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
                        
                        const filename = path.join(debugDir, `tecdoc-article-details-${articleNumber}-${Date.now()}.json`);
                        fs.writeFileSync(filename, JSON.stringify(response, null, 2));
                        console.log(`Saved raw API response to ${filename}`);
                    } else {
                        console.log('Raw response saving skipped in browser environment');
                    }
                } catch (error) {
                    console.error('Failed to save raw API response:', error);
                }
            }
        }
        
        return json(formattedResponse);
        
    } catch (error) {
        console.error('TecDoc article lookup error:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        } as TecDocArticleResponse);
    }
}; 