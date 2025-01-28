import { supabase } from '$lib/db/supabaseClient';
import type { RequestHandler } from './$types';

// Score a match based on how complete its product information is
function scoreProductCompleteness(match: any): number {
    let score = 0;
    if (match.products.completeFront) score += 2;
    if (match.products.completeRear) score += 2;
    if (match.products.bar) score += 1;
    if (match.products.foot) score += 1;
    if (match.products.kit) score += 1;
    return score;
}

// Clean and normalize input for matching
function normalizeInput(input: string): string {
    return input.toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')  // Normalize spaces
        .replace(/[-–—]/g, '-'); // Normalize different types of dashes
}

// Normalize model names for comparison
function normalizeModelName(model: string, make?: string): string {
    const normalized = normalizeInput(model);
    
    // Special handling for BMW models
    if (make?.toUpperCase() === 'BMW') {
        // Convert specific model numbers to series (e.g., "320" -> "3-series")
        if (/^\d{3}[a-z]?i?$/i.test(normalized)) {
            const series = normalized.charAt(0);
            return `${series}-series`;
        }
        
        // Convert M models to series (e.g., "M4" -> "4-series")
        if (/^m\d{1,2}$/i.test(normalized)) {
            const series = normalized.match(/\d+/)?.[0];
            return `${series}-series`;
        }
        
        // If already in series format, standardize it
        if (normalized.includes('series') || normalized.includes('-series')) {
            return normalized.replace(/(\d+)(?:\s*-?\s*series|er)/i, '$1-series');
        }
        
        // If just a number is provided, assume it's a series
        if (/^\d+$/.test(normalized)) {
            return `${normalized}-series`;
        }
    }
    
    return normalized;
}

// Check if two models match
function modelsMatch(inputModel: string, dbModel: string, make?: string): boolean {
    const normalizedInput = normalizeModelName(inputModel, make);
    const normalizedDb = normalizeModelName(dbModel, make);
    
    // Exact match after normalization
    if (normalizedInput === normalizedDb) return true;
    
    // For BMW and similar manufacturers with series numbers
    if (make?.toUpperCase() === 'BMW') {
        // Extract series numbers for comparison
        const inputSeries = normalizedInput.match(/^(\d+)-series/i)?.[1];
        const dbSeries = normalizedDb.match(/^(\d+)-series/i)?.[1];
        
        if (inputSeries && dbSeries && inputSeries === dbSeries) {
            return true;
        }
    }
    
    // For e-tron style matching (base model matching)
    const inputParts = normalizedInput.split(/\s+/);
    const dbParts = normalizedDb.split(/\s+/);
    
    // If the first parts match (e.g., "e-tron" is the base model)
    if (inputParts[0] === dbParts[0]) {
        // If only base model was provided, only match base models
        return inputParts.length === 1 ? dbParts.length === 1 : true;
    }
    
    return false;
}

export const GET: RequestHandler = async ({ url }) => {
    const make = url.searchParams.get('make');
    const model = url.searchParams.get('model');
    const year = url.searchParams.get('year');

    if (!make || !model) {
        return new Response(JSON.stringify({ error: 'Make and model are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // First, get all potential matches for the make
    const { data: makeMatches, error: makeError } = await supabase
        .from('car_fits')
        .select('*')
        .ilike('Car Make', make);

    if (makeError) {
        return new Response(JSON.stringify({ error: 'Database query failed', details: makeError }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Filter and process matches
    let matches = makeMatches.filter(match => modelsMatch(model, match['Car Model'], make));

    // Filter by year if provided
    if (year) {
        const numericYear = parseInt(year);
        matches = matches.filter(match => {
            const startYear = parseInt(match['Car Start Year']);
            const endYear = match['Car Stop Year'] ? parseInt(match['Car Stop Year']) : new Date().getFullYear();
            return numericYear >= startYear && numericYear <= endYear;
        });
    }

    // Transform matches into a more useful format and sort by completeness
    const processedMatches = matches.map(m => ({
        model: m['Car Model'],
        year: { 
            start: m['Car Start Year'], 
            end: m['Car Stop Year']
        },
        variation: m['Car Variation'],
        products: {
            completeFront: m['Complete Front Rack ID'],
            completeRear: m['Complete Rear Rack ID'],
            bar: m['Bar ID'],
            foot: m['Foot ID'],
            kit: m['RackSolution Kit ID']
        },
        completenessScore: scoreProductCompleteness({
            products: {
                completeFront: m['Complete Front Rack ID'],
                completeRear: m['Complete Rear Rack ID'],
                bar: m['Bar ID'],
                foot: m['Foot ID'],
                kit: m['RackSolution Kit ID']
            }
        })
    }));

    // Sort by completeness score
    processedMatches.sort((a, b) => b.completenessScore - a.completenessScore);

    return new Response(JSON.stringify({
        matches: processedMatches,
        summary: {
            totalMatches: processedMatches.length,
            bestMatch: processedMatches[0] || null,
            normalizedSearch: {
                make: normalizeInput(make),
                model: normalizeModelName(model, make)
            }
        }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}; 