import { supabase } from './supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';

interface ImportResult {
    success: boolean;
    error?: PostgrestError | Error;
    stats?: {
        processed: number;
        skipped: number;
        duplicates: number;
    };
}

export async function importCsvData(csvData: any[]): Promise<ImportResult> {
    const BATCH_SIZE = 100; // Process 100 rows at a time
    let processedRows = 0;
    const stats = {
        processed: 0,
        skipped: 0,
        duplicates: 0
    };

    try {
        // Process data in batches
        for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
            const batch = csvData.slice(i, i + BATCH_SIZE);
            
            // Use a Map to deduplicate rows based on the unique constraint
            const uniqueRows = new Map();
            
            batch.forEach(row => {
                // Skip row if missing required data
                if (!row['Car Make'] || !row['Car Model']) {
                    stats.skipped++;
                    return;
                }

                // Parse K-TYPE into JSONB if it exists
                let kType = null;
                if (row['K-TYPE']) {
                    try {
                        kType = JSON.parse(row['K-TYPE']);
                    } catch (e) {
                        console.warn('Failed to parse K-TYPE:', row['K-TYPE']);
                    }
                }

                const processedRow = {
                    car_make: row['Car Make'],
                    car_model: row['Car Model'],
                    car_start_year: row['Car Start Year'] ? parseInt(row['Car Start Year']) : null,
                    car_stop_year: row['Car Stop Year'] ? parseInt(row['Car Stop Year']) : null,
                    car_type: row['Car Type'] || null,
                    number_of_doors: row['Number of Doors'] || null,
                    car_variation: row['Car Variation'] || null,
                    k_type: kType,
                    solution_product_id: row['Solution Product ID'] || null,
                    complete_front_rack_id: row['Complete Front Rack ID'] || null,
                    bar_id: row['Bar ID'] || null,
                    foot_id: row['Foot ID'] || null,
                    racksolution_kit_id: row['RackSolution Kit ID'] || null,
                    adapter_id: row['Adapter ID'] || null
                };

                // Create a unique key that includes all product IDs
                const key = [
                    processedRow.car_make,
                    processedRow.car_model,
                    processedRow.car_variation || '',
                    processedRow.solution_product_id || '',
                    processedRow.complete_front_rack_id || '',
                    processedRow.bar_id || '',
                    processedRow.foot_id || '',
                    processedRow.racksolution_kit_id || '',
                    processedRow.adapter_id || ''
                ].join('|');
                
                if (uniqueRows.has(key)) {
                    stats.duplicates++;
                    // Could add logic here to merge data from duplicate rows if needed
                } else {
                    uniqueRows.set(key, processedRow);
                }
            });

            const rows = Array.from(uniqueRows.values());

            if (rows.length > 0) {
                const { error } = await supabase
                    .from('car_fits')
                    .upsert(rows, {
                        onConflict: 'car_make,car_model,car_variation'
                    });

                if (error) throw error;
                stats.processed += rows.length;
            }

            processedRows += batch.length;
            console.log(`Processed ${processedRows}/${csvData.length} rows (${stats.duplicates} duplicates found)`);
        }

        return {
            success: true,
            stats
        };

    } catch (error) {
        console.error('Import error:', error);
        return {
            success: false,
            error: error as Error,
            stats
        };
    }
} 