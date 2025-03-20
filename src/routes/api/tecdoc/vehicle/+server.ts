import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TecDocService } from '$lib/services/TecDocService';

interface TecDocVehicleResponse {
    success: boolean;
    vehicle?: {
        id: number;
        name: string;
        manufacturer: {
            id: number;
            name: string;
        };
        model: string;
        type: {
            main: string;
            sub: string;
        };
    };
    error?: string;
    debug?: any;
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        const licensePlate = url.searchParams.get('plate')?.trim();
        const country = url.searchParams.get('country')?.trim() || 'NO';
        
        console.log('Looking up vehicle:', { licensePlate, country });

        if (!licensePlate) {
            return json({
                success: false,
                error: 'License plate is required'
            } as TecDocVehicleResponse);
        }

        const tecDocService = new TecDocService();
        const vehicleResponse = await tecDocService.getVehicleByLicensePlate(licensePlate, country);

        console.log('TecDoc response:', JSON.stringify(vehicleResponse, null, 2));

        if (!vehicleResponse.data?.array?.[0]) {
            return json({
                success: false,
                error: 'Vehicle not found',
                debug: vehicleResponse
            } as TecDocVehicleResponse);
        }

        const vehicle = vehicleResponse.data.array[0];
        console.log('Found vehicle:', vehicle);

        return json({
            success: true,
            vehicle: {
                id: vehicle.carId,
                name: vehicle.carName,
                manufacturer: {
                    id: vehicle.manuId,
                    name: vehicle.carName.split(' ')[0] // Extract manufacturer name from car name
                },
                model: vehicle.carName.split(' ').slice(1).join(' '), // Extract model from car name
                type: {
                    main: vehicle.linkingTargetType,
                    sub: vehicle.subLinkageTargetType
                }
            }
        } as TecDocVehicleResponse);

    } catch (error) {
        console.error('TecDoc vehicle lookup error:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process request',
            debug: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error
        } as TecDocVehicleResponse, { status: 500 });
    }
}; 