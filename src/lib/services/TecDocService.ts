import { TEC_DOC_API_KEY, PROVIDER_ID } from '$env/static/private';
import { XMLParser } from 'fast-xml-parser';

interface TecDocError {
    status: number;
    statusText: string;
    details?: string;
}

export interface TecDocResponse<T> {
    data?: T;
    status: number;
    statusText?: string;
    articles?: any[];
    totalMatchingArticles?: number;
    maxAllowedPage?: number;
}

interface TecDocVehicle {
    linkageTargetId: number;
    mfrId: number;
    mfrName: string;
    vehicleModelSeriesName: string;
    beginYearMonth: string;
    endYearMonth: string;
    engineType: string;
    fuelType: string;
    powerHP: number;
    powerKW: number;
    capacity: number;
    bodyType: string;
}

interface TecDocArticle {
    articleId?: number;
    articleNumber: string;
    brandName?: string;
    mfrName?: string;
    mfrId?: number;
    dataSupplierId?: number;
    genericArticleName?: string;
    articleStatusId?: number;
    packingUnit?: number;
    quantityPerPackingUnit?: number;
    immediateDisplayQuantity?: number;
    immediateDisplayPrice?: number;
    thumbnailName?: string;
}

// Enhanced article interface with more details
export interface EnhancedArticle extends TecDocArticle {
    description?: string;
    genericArticleDescription?: string;
    assemblyGroup?: string;
    attributes?: Array<{
        attrName: string;
        attrValue: string;
        displayValue?: string;
        displayUnit?: string;
    }>;
    images?: string[];
    oemNumbers?: string[];
    usageNumbers?: string[];
}

interface VehicleIdResponse {
    array: Array<{
        carId: number;
        carName: string;
        country: string;
        linkingTargetType: string;
        subLinkageTargetType: string;
        manuId: number;
        modelId: number;
    }>;
}

interface TecDocVehicleResponse {
    linkageTargetId: number;
    mfrId: number;
    mfrName: string;
    vehicleModelSeriesName: string;
    beginYearMonth: string;
    endYearMonth: string;
    engineType: string;
    fuelType: string;
    powerHP: number;
    powerKW: number;
    capacity: number;
    bodyType: string;
}

// New interface for assembly group nodes
export interface AssemblyGroupNode {
    assemblyGroupNodeId: number;
    assemblyGroupName: string;
    assemblyGroupType: string;
    parentNodeId?: number;
    children?: number;
    hasArticles?: boolean;
}

export class TecDocService {
    private baseUrl: string;
    private headers: HeadersInit;
    private requestCount = 0;
    private cache: Map<string, any> = new Map(); // Add cache for API responses
    private cacheTTL = 3600000; // Cache TTL in milliseconds (1 hour)
    private useMockData = false; // Flag to use mock data instead of real API calls
    private useMockDataForLicensePlate = true; // Always use mock data for license plate lookups
    public lastTotalMatchingArticles: number = 0; // Store the total number of matching articles from the last request

    constructor(options?: { useMockData?: boolean }) {
        // Update to match the working Postman endpoint
        this.baseUrl = 'https://webservice.tecalliance.services/pegasus-3-0/info/proxy/services/TecdocToCatDLB.jsonEndpoint';
        
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Api-Key': TEC_DOC_API_KEY
        };

        this.useMockData = options?.useMockData || false;

        console.log('TecDoc Service Initialization:', {
            apiKeyPresent: !!TEC_DOC_API_KEY,
            apiKeyLength: TEC_DOC_API_KEY?.length || 0,
            providerId: PROVIDER_ID,
            baseUrl: this.baseUrl,
            useMockData: this.useMockData,
            useMockDataForLicensePlate: this.useMockDataForLicensePlate
        });
    }

    private getErrorMessage(error: TecDocError): string {
        switch (error.status) {
            case 400:
                return 'Bad Request - Missing or invalid parameters';
            case 401:
                return 'Unauthorized - API key is missing or invalid';
            case 403:
                return 'Forbidden - API key does not have permission or IP not whitelisted';
            case 404:
                return 'Vehicle or resource not found';
            case 407:
                return 'Authentication failed - API key might be expired or invalid';
            case 429:
                return 'Rate limit exceeded - too many requests';
            case 500:
                return 'Internal server error - please try again later';
            default:
                return error.statusText || 'Unknown error';
        }
    }

    private async makeRequest<T>(method: string, params: any): Promise<TecDocResponse<T>> {
        // Special case for license plate lookups - always use mock data to save credits
        if (method === 'getVehiclesByKeyNumberPlates' && this.useMockDataForLicensePlate) {
            console.log(`Using mock data for ${method} to save API credits`);
            return this.getMockResponse(method, params);
        }
        
        // For other methods, check if we should use mock data
        if (this.useMockData) {
            return this.getMockResponse(method, params);
        }

        // Detect if we're in a browser environment and log a warning if attempting to make an API call
        const isBrowser = typeof window !== 'undefined';
        if (isBrowser) {
            console.warn(`Making TecDoc API request (${method}) from browser environment. Consider using server-side calls instead to protect your API key.`);
        }

        // Check cache first
        const cacheKey = `${method}-${JSON.stringify(params)}`;
        const cachedResponse = this.cache.get(cacheKey);
        
        if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
            console.log(`Using cached response for ${method}`);
            return cachedResponse.data;
        }

        this.requestCount++;
        // Wrap the params in the method name as per Postman example
        const requestBody = {
            [method]: {
                provider: PROVIDER_ID,
                lang: 'no',
                country: 'NO',
                ...params
            }
        };

        const requestId = `${method}-${Date.now()}-${this.requestCount}`;
        console.log(`[${requestId}] Making request to:`, this.baseUrl);
        console.log(`[${requestId}] Request headers:`, {
            ...this.headers,
            'X-Api-Key': 'REDACTED'
        });
        console.log(`[${requestId}] Request body:`, JSON.stringify(requestBody, null, 2));
        console.log(`[${requestId}] Provider ID:`, PROVIDER_ID);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(requestBody)
            });

            const responseText = await response.text();
            console.log(`[${requestId}] Response status:`, response.status, response.statusText);
            console.log(`[${requestId}] Response headers:`, Object.fromEntries(response.headers.entries()));
            console.log(`[${requestId}] Raw response:`, responseText);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status} ${response.statusText}\nResponse: ${responseText}`);
            }

            let data: any;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error(`[${requestId}] Failed to parse response as JSON:`, e);
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            if (data.status && data.status !== 200) {
                const error: TecDocError = {
                    status: data.status,
                    statusText: data.statusText || 'Unknown error'
                };
                throw new Error(this.getErrorMessage(error));
            }

            // Cache the successful response
            this.cache.set(cacheKey, {
                data: data as TecDocResponse<T>,
                timestamp: Date.now()
            });

            return data as TecDocResponse<T>;
        } catch (error) {
            console.error(`[${requestId}] Request failed:`, error);
            if (error instanceof Error) {
                throw new Error(`TecDoc API error: ${error.message}`);
            }
            throw error;
        }
    }

    async getVehicleByLicensePlate(licensePlate: string, country: string = 'NO'): Promise<TecDocResponse<VehicleIdResponse>> {
        console.log('Looking up vehicle by license plate:', {
            licensePlate,
            country,
            apiKeyLength: TEC_DOC_API_KEY?.length || 0,
            providerId: PROVIDER_ID
        });

        const response = await this.makeRequest<VehicleIdResponse>('getVehiclesByKeyNumberPlates', {
            country: country,
            keySystemNumber: licensePlate,
            keySystemType: 95,
            lang: 'no',
            provider: PROVIDER_ID
        });

        return response;
    }

    async getVehicleDetails(linkageTargetId: number): Promise<TecDocVehicleResponse> {
        const response = await this.makeRequest<TecDocVehicleResponse>('getLinkageTargets', {
            linkageTargetId,
            lang: 'en',
            perPage: 1,
            page: 1
        });

        if (!response.data) {
            throw new Error('Vehicle details not found');
        }

        return response.data;
    }

    async getCompatibleParts(linkageTargetId: number, genericArticleId?: number, assemblyGroupNodeId: number = 100002): Promise<TecDocArticle[]> {
        const query: any = {
            linkageTargetId,
            lang: 'en',
            perPage: 100,
            page: 1,
            articleCountry: 'NO',
            linkageTargetType: 'P',
            assemblyGroupNodeId: assemblyGroupNodeId,
            includeMisc: true,
            includeGenericArticles: true,
            includeArticleText: true
        };

        if (genericArticleId) {
            query.genericArticleId = genericArticleId;
        }

        // The response from this endpoint has a different structure than other endpoints
        // Articles are at the top level, not in a data property
        const rawResponse = await this.makeRequest<any>('getArticles', query);
        
        // Store the total number of matching articles
        this.lastTotalMatchingArticles = rawResponse.totalMatchingArticles || 0;
        
        console.log('Articles response structure:', {
            keys: Object.keys(rawResponse),
            articleCount: rawResponse.articles?.length || 0,
            totalMatching: rawResponse.totalMatchingArticles
        });
        
        // Save the raw response to a file for debugging
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
                    
                    const filename = path.join(debugDir, `tecdoc-parts-${linkageTargetId}-${assemblyGroupNodeId}-${Date.now()}.json`);
                    fs.writeFileSync(filename, JSON.stringify(rawResponse, null, 2));
                    console.log(`Saved raw TecDoc response to ${filename}`);
                } else {
                    console.log('Raw response saving skipped in browser environment');
                }
            } catch (error) {
                console.error('Failed to save raw response:', error);
            }
        }
        
        // Check if there are more pages to fetch
        const totalPages = Math.ceil((rawResponse.totalMatchingArticles || 0) / 100);
        let allArticles = rawResponse.articles || [];
        
        // Fetch additional pages if needed (up to 5 pages total to avoid too many API calls)
        if (totalPages > 1 && !this.useMockData) {
            const maxPagesToFetch = Math.min(totalPages, 5) - 1; // -1 because we already fetched page 1
            console.log(`Fetching ${maxPagesToFetch} additional pages of parts (out of ${totalPages - 1} remaining pages)`);
            
            for (let page = 2; page <= maxPagesToFetch + 1; page++) {
                const pageQuery = { ...query, page };
                try {
                    const pageResponse = await this.makeRequest<any>('getArticles', pageQuery);
                    if (pageResponse.articles && pageResponse.articles.length > 0) {
                        allArticles = [...allArticles, ...pageResponse.articles];
                        console.log(`Fetched page ${page}/${maxPagesToFetch + 1}, got ${pageResponse.articles.length} more parts`);
                        
                        // Also save each page response for debugging
                        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
                            try {
                                // Only attempt to use require in server-side environments
                                if (typeof window === 'undefined') {
                                    const fs = require('fs');
                                    const path = require('path');
                                    const debugDir = path.join(process.cwd(), 'debug');
                                    const filename = path.join(debugDir, `tecdoc-parts-${linkageTargetId}-${assemblyGroupNodeId}-page${page}-${Date.now()}.json`);
                                    fs.writeFileSync(filename, JSON.stringify(pageResponse, null, 2));
                                    console.log(`Saved raw TecDoc page ${page} response to ${filename}`);
                                } else {
                                    console.log(`Skipped saving page ${page} response in browser environment`);
                                }
                            } catch (error) {
                                console.error(`Failed to save raw page ${page} response:`, error);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Failed to fetch page ${page}:`, error);
                    break;
                }
            }
        }
        
        console.log(`Returning ${allArticles.length} parts out of ${rawResponse.totalMatchingArticles} total matching parts`);
        return allArticles;
    }

    async getArticleDetails(articleId: number): Promise<TecDocArticle> {
        const response = await this.makeRequest<any>('getDirectArticlesByIds7', {
            articleId: [articleId],
            lang: 'en'
        });

        if (!response.data?.[0]) {
            throw new Error('Article not found');
        }

        return response.data[0];
    }

    // New method to get enhanced article details
    async getEnhancedArticleDetails(articleId: number, dataSupplierId: number): Promise<EnhancedArticle> {
        try {
            // First get basic article info
            const response = await this.makeRequest<any>('getArticleDirectSearchAllNumbersWithState', {
                articleNumber: articleId.toString(),
                dataSupplierId: dataSupplierId,
                lang: 'en',
                searchExact: true
            });

            if (!response.data?.array?.[0]) {
                throw new Error('Article details not found');
            }

            const basicInfo = response.data.array[0];
            
            // Then get additional details including attributes
            const detailsResponse = await this.makeRequest<any>('getArticlesByIds6', {
                articleId: [articleId],
                attributs: true,
                basicData: true,
                documents: true,
                eanNumbers: true,
                immediateAttributs: true,
                immediateInfo: true,
                info: true,
                mainArticle: true,
                normalAustauschPrice: true,
                oeNumbers: true,
                prices: true,
                replacedByNumbers: true,
                replacedNumbers: true,
                thumbnails: true,
                usageNumbers: true,
                lang: 'en'
            });

            const detailedInfo = detailsResponse.data?.[0] || {};
            
            // Combine the information
            return {
                articleId: basicInfo.articleId || articleId,
                articleNumber: basicInfo.articleNumber || '',
                brandName: basicInfo.brandName || '',
                mfrName: basicInfo.mfrName || '',
                mfrId: basicInfo.mfrId || 0,
                dataSupplierId: basicInfo.dataSupplierId || dataSupplierId,
                genericArticleName: basicInfo.genericArticleName || '',
                description: detailedInfo.articleName || '',
                genericArticleDescription: detailedInfo.genericArticleDescription || '',
                assemblyGroup: detailedInfo.assemblyGroupName || '',
                attributes: detailedInfo.allArticleAttributes?.array?.map((attr: any) => ({
                    attrName: attr.attrName || '',
                    attrValue: attr.attrValue || '',
                    displayValue: attr.displayValue || '',
                    displayUnit: attr.displayUnit || ''
                })) || [],
                images: detailedInfo.articleDocuments?.array?.map((doc: any) => doc.docFileName || '') || [],
                oemNumbers: detailedInfo.articleOENumbers?.array?.map((oe: any) => oe.oeNumber || '') || [],
                usageNumbers: detailedInfo.articleUsageNumbers?.array?.map((usage: any) => usage.usageNumber || '') || []
            };
        } catch (error) {
            console.error('Failed to get enhanced article details:', error);
            // Return a basic article object if enhanced details fail
            return {
                articleId: articleId,
                articleNumber: articleId.toString(),
                dataSupplierId: dataSupplierId
            };
        }
    }

    // New method to get assembly groups for a vehicle
    async getAssemblyGroups(linkageTargetId: number): Promise<AssemblyGroupNode[]> {
        try {
            const response = await this.makeRequest<any>('getAssemblyGroupNodes', {
                linkageTargetId,
                lang: 'en',
                linkageTargetType: 'P',
                country: 'NO',
                provider: PROVIDER_ID
            });

            if (!response.data?.array) {
                console.warn('No assembly groups found in response:', response);
                return [];
            }

            return response.data.array.map((node: any) => ({
                assemblyGroupNodeId: node.assemblyGroupNodeId,
                assemblyGroupName: node.assemblyGroupName,
                assemblyGroupType: node.assemblyGroupType || 'P',
                parentNodeId: node.parentNodeId,
                children: node.children,
                hasArticles: node.hasArticles
            }));
        } catch (error) {
            console.error('Failed to fetch assembly groups:', error);
            return [];
        }
    }

    // Add method to get mock responses
    private getMockResponse<T>(method: string, params: any): TecDocResponse<T> {
        console.log(`Returning mock data for ${method}`);
        
        // Mock vehicle data for EB34033 - using the exact response from the documentation
        if (method === 'getVehiclesByKeyNumberPlates' && params.keySystemNumber === 'EB34033') {
            return {
                status: 200,
                data: {
                    array: [{
                        carId: 138779,
                        carName: "AUDI E-TRON (GEN) 50 quattro",
                        country: "NO",
                        linkingTargetType: "P",
                        subLinkageTargetType: "V",
                        manuId: 5,
                        modelId: 39213,
                        vehicleDetails: {
                            engineCode: "EAWA",
                            engineCodes: [
                                "EAWA"
                            ],
                            registrationNumber: "EB34033",
                            tecDocNumber: "138779",
                            tecDocType: "PASSENGER"
                        }
                    }]
                }
            } as TecDocResponse<T>;
        }
        
        // For other methods, return generic mock data only if useMockData is true
        if (this.useMockData) {
            // Mock parts data
            if (method === 'getArticles') {
                const mockParts = [];
                // Generate 20 different mock parts
                for (let i = 1; i <= 20; i++) {
                    mockParts.push({
                        articleId: 1000 + i,
                        articleNumber: `MOCK-${i}`,
                        mfrName: i % 3 === 0 ? 'BOSCH' : (i % 2 === 0 ? 'ATE' : 'BREMBO'),
                        dataSupplierId: 100 + i,
                        genericArticleName: i % 2 === 0 ? 'Brake Disc' : 'Brake Pad',
                        articleStatusId: 1,
                        packingUnit: 1,
                        quantityPerPackingUnit: 2,
                        immediateDisplayQuantity: 1,
                        immediateDisplayPrice: 100 + (i * 10),
                        thumbnailName: ''
                    });
                }
                
                return {
                    status: 200,
                    articles: mockParts,
                    totalMatchingArticles: mockParts.length,
                    maxAllowedPage: 1
                } as TecDocResponse<T>;
            }
            
            // Mock article details
            if (method === 'getArticleDirectSearchAllNumbersWithState') {
                return {
                    status: 200,
                    data: {
                        array: [{
                            articleId: 12345,
                            articleNumber: params.articleNumber,
                            brandName: 'Mock Brand',
                            mfrName: 'Mock Manufacturer',
                            mfrId: params.brandId || 0,
                            dataSupplierId: 100,
                            genericArticleName: 'Mock Part',
                            articleName: 'Detailed Mock Part Description'
                        }]
                    }
                } as TecDocResponse<T>;
            }
        }
        
        // Default empty response
        return {
            status: 200,
            data: {} as T
        };
    }

    // New method to get article details by article number and brand
    async getArticleDetailsByNumber(articleNumber: string, brandId: number): Promise<EnhancedArticle | null> {
        try {
            const query = {
                articleNumber: articleNumber,
                brandId: brandId,
                articleCountry: 'NO', // Add the required articleCountry parameter
                lang: 'en',
                searchExact: true
            };
            
            const response = await this.makeRequest<any>('getArticleDirectSearchAllNumbersWithState', query);
            
            // Save the raw response to a file for debugging
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
                        
                        const filename = path.join(debugDir, `tecdoc-article-details-${articleNumber}-${brandId}-${Date.now()}.json`);
                        fs.writeFileSync(filename, JSON.stringify(response, null, 2));
                        console.log(`Saved raw article details response to ${filename}`);
                    } else {
                        console.log('Raw response saving skipped in browser environment');
                    }
                } catch (error) {
                    console.error('Failed to save raw article details response:', error);
                }
            }

            if (!response.data?.array?.[0]) {
                return null;
            }

            const article = response.data.array[0];
            return {
                articleId: article.articleId,
                articleNumber: article.articleNumber || articleNumber,
                brandName: article.brandName || '',
                mfrName: article.mfrName || '',
                mfrId: article.mfrId || brandId,
                dataSupplierId: article.dataSupplierId || 0,
                genericArticleName: article.genericArticleName || '',
                description: article.articleName || '',
                genericArticleDescription: article.genericArticleDescription || '',
                assemblyGroup: article.assemblyGroupName || '',
                attributes: article.attributes || [],
                images: article.images || [],
                oemNumbers: article.oemNumbers || [],
                usageNumbers: article.usageNumbers || []
            };
        } catch (error) {
            console.error('Failed to get article details by number:', error);
            return null;
        }
    }

    /**
     * Make a custom request to the TecDoc API using the getArticles method
     * This is based on the Postman collection and provides direct access to article details
     * @param method The API method to call
     * @param params The parameters to send with the request
     * @returns The API response
     */
    async makeCustomRequest(method: string, params: any): Promise<any> {
        try {
            const response = await this.makeRequest<any>(method, params);
            
            // Store the total number of matching articles for pagination
            if (response.totalMatchingArticles) {
                this.lastTotalMatchingArticles = response.totalMatchingArticles;
            }
            
            return response;
        } catch (error) {
            console.error(`Failed to make custom request to ${method}:`, error);
            throw error;
        }
    }
} 