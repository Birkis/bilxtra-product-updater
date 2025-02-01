import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabase } from '$lib/db/supabaseClient';
import { openai } from '$lib/openaiClient';

interface CsvRow {
    'Car Make': string;
    'Car Model': string;
    'Car Start Year': string;
    'Car Stop Year'?: string;
    'Car Type'?: string;
    'Number of Doors'?: string;
    'Car Variation'?: string;
    'Car Description'?: string;
    'Front Rack ID'?: string;
    'Front Rack Name'?: string;
    'Rear Rack ID'?: string;
    'Rear Rack Name'?: string;
    'Bar ID'?: string;
    'Bar Name'?: string;
    'Foot ID'?: string;
    'Foot Name'?: string;
    'Kit ID'?: string;
    'Kit Name'?: string;
    'Compatible Bar For Caprock'?: string;
    'Compatible Rack For Tent'?: string;
    'Compatible Roof For Tent'?: string;
    'Foot Attachment'?: string;
    'Rack Product'?: string;
}

interface CarData {
    make: string;
    model: string;
    car_start_year: number;
    car_stop_year?: number;
    car_type?: string;
    number_of_doors?: string;
    car_variation?: string;
    car_description: string;
    front_rack_id?: number;
    front_rack_name?: string;
    rear_rack_id?: number;
    rear_rack_name?: string;
    bar_id?: number;
    bar_name?: string;
    foot_id?: number;
    foot_name?: string;
    kit_id?: number;
    kit_name?: string;
    compatible_bar_for_caprock?: boolean;
    compatible_rack_for_tent?: boolean;
    compatible_roof_for_tent?: boolean;
    foot_attachment?: string;
    rack_product?: string;
}

interface CarDetailsVector {
    car_data_id: number;
    car_description: string;
    embedding: number[];
}

export async function POST({ request }: RequestEvent) {
    try {
        const { csvData } = await request.json();
        
        const results = {
            processed: 0,
            errors: [] as string[],
            skipped: 0
        };

        // Process in batches to avoid overwhelming the API
        const BATCH_SIZE = 10;
        
        for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
            const batch = csvData.slice(i, i + BATCH_SIZE);
            
            for (const row of batch) {
                try {
                    // Skip if missing required fields
                    if (!row['Car Make'] || !row['Car Model']) {
                        results.skipped++;
                        continue;
                    }

                    // Generate car description if not provided
                    const carDescription = row['Car Description'] || generateCarDescription(row);

                    // Prepare car data
                    const carData: CarData = {
                        make: row['Car Make'],
                        model: row['Car Model'],
                        car_start_year: parseInt(row['Car Start Year']),
                        car_stop_year: row['Car Stop Year'] ? parseInt(row['Car Stop Year']) : undefined,
                        car_type: row['Car Type'],
                        number_of_doors: row['Number of Doors'],
                        car_variation: row['Car Variation'],
                        car_description: carDescription,
                        // Product IDs and names
                        front_rack_id: row['Front Rack ID'] ? parseInt(row['Front Rack ID']) : undefined,
                        front_rack_name: row['Front Rack Name'],
                        rear_rack_id: row['Rear Rack ID'] ? parseInt(row['Rear Rack ID']) : undefined,
                        rear_rack_name: row['Rear Rack Name'],
                        bar_id: row['Bar ID'] ? parseInt(row['Bar ID']) : undefined,
                        bar_name: row['Bar Name'],
                        foot_id: row['Foot ID'] ? parseInt(row['Foot ID']) : undefined,
                        foot_name: row['Foot Name'],
                        kit_id: row['Kit ID'] ? parseInt(row['Kit ID']) : undefined,
                        kit_name: row['Kit Name'],
                        // Additional metadata
                        compatible_bar_for_caprock: row['Compatible Bar For Caprock'] === 'Yes',
                        compatible_rack_for_tent: row['Compatible Rack For Tent'] === 'Yes',
                        compatible_roof_for_tent: row['Compatible Roof For Tent'] === 'Yes',
                        foot_attachment: row['Foot Attachment'],
                        rack_product: row['Rack Product']
                    };

                    // Insert into car_data
                    const { data: carDataResult, error: carDataError } = await supabase
                        .from('car_data')
                        .insert(carData)
                        .select()
                        .single();

                    if (carDataError) throw carDataError;

                    // Generate embeddings
                    const embeddingResponse = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: carData.car_description,
                        encoding_format: "float"
                    });

                    const embedding = embeddingResponse.data[0].embedding;

                    // Insert into car_details_vector
                    const carDetailsVector: CarDetailsVector = {
                        car_data_id: carDataResult.id,
                        car_description: carData.car_description,
                        embedding: embedding
                    };

                    const { error: vectorError } = await supabase
                        .from('car_details_vector')
                        .insert(carDetailsVector);

                    if (vectorError) throw vectorError;

                    results.processed++;
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    results.errors.push(`Error processing row ${i}: ${errorMessage}`);
                }
            }
        }

        return json({
            success: true,
            results
        });

    } catch (err) {
        console.error('Vector import error:', err);
        return json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 });
    }
}

function generateCarDescription(row: CsvRow): string {
    const parts = [
        row['Car Make'],
        row['Car Model'],
        row['Car Type'],
        row['Number of Doors'],
        row['Car Variation'],
        row['Car Start Year'],
        row['Car Stop Year'] ? `- ${row['Car Stop Year']}` : 'onwards',
        // Include product information if available
        row['Front Rack Name'],
        row['Rear Rack Name'],
        row['Bar Name'],
        row['Foot Name'],
        row['Kit Name'],
        // Include compatibility information
        row['Compatible Bar For Caprock'] === 'Yes' ? 'Caprock Compatible' : '',
        row['Compatible Rack For Tent'] === 'Yes' ? 'Rack Tent Compatible' : '',
        row['Compatible Roof For Tent'] === 'Yes' ? 'Roof Tent Compatible' : '',
        row['Foot Attachment'],
        row['Rack Product']
    ].filter(Boolean);

    return parts.join(', ');
} 