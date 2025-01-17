import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function GET({ url }) {
    try {
        const dataType = url.searchParams.get('type') || 'product';
        
        const query = dataType === 'car' ? `{
            masterDataHierarchyCarSolution {
                getMasterDataHierarchyCarSolution {
                    fileName,
                    fileSizeInBytes,
                    fileAsBase64
                }
            }
        }` : `{
            masterDataHierarchyProduct {
                getMasterDataHierarchyProduct {
                    fileName,
                    fileSizeInBytes,
                    fileAsBase64
                }
            }
        }`;

        console.log(`Initiating Thule API request for ${dataType} data...`);
        
        if (!env.THULE_API_KEY) {
            console.error('THULE_API_KEY is not set in environment variables');
            return json({ error: 'API key configuration error' }, { status: 500 });
        }

        const response = await fetch('https://datalayerapi.thule.com/downloadfiles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': env.THULE_API_KEY
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Thule API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            return json({ 
                error: 'Failed to fetch Thule data',
                details: `Status: ${response.status} ${response.statusText}`
            }, { status: response.status });
        }

        const data = await response.json();
        console.log('Raw API Response:', JSON.stringify(data, null, 2));
        
        // Get the correct path based on data type
        const files = dataType === 'car' 
            ? data?.data?.masterDataHierarchyCarSolution?.getMasterDataHierarchyCarSolution
            : data?.data?.masterDataHierarchyProduct?.getMasterDataHierarchyProduct;
        
        if (!files) {
            console.error('Unexpected API response structure:', data);
            return json({ error: 'Invalid API response format' }, { status: 500 });
        }

        // Handle both single file and array of files
        const fileArray = Array.isArray(files) ? files : [files];
        
        // Validate and process each file
        const processedFiles = fileArray.map(file => {
            console.log('Processing file:', {
                fileName: file.fileName,
                fileSizeInBytes: file.fileSizeInBytes,
                base64Length: file.fileAsBase64?.length || 0
            });

            if (!file.fileAsBase64) {
                console.error('Missing base64 data for file:', file.fileName);
                return null;
            }

            // Ensure the base64 string is properly padded
            let base64 = file.fileAsBase64;
            while (base64.length % 4) {
                base64 += '=';
            }

            return {
                ...file,
                fileAsBase64: base64
            };
        }).filter(Boolean);

        if (processedFiles.length === 0) {
            return json({ error: 'No valid files in response' }, { status: 500 });
        }

        return json(processedFiles);
    } catch (error) {
        console.error('Error in Thule data endpoint:', error);
        return json({ 
            error: 'Failed to fetch Thule data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 