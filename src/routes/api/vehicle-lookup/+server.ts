import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { STATENS_VEGVESEN_API_KEY } from '$env/static/private';

interface VehicleResponse {
    success: boolean;
    car?: {
        make: string;
        model: string;
        year: number;
        doors: string;
        color?: string;
        bodyType?: string;
        dimensions?: {
            length?: number;
            width?: number;
            height?: number;
        };
        weight?: {
            total?: number;
            maxRoofLoad?: number;
            payload?: number;
            totalAllowed?: number;
            trailerWeight?: {
                withBrakes?: number;
                withoutBrakes?: number;
                verticalLoad?: number;
                totalTrainWeight?: number;
            };
        };
        engine?: {
            type: 'electric' | 'hybrid' | 'conventional';
            maxSpeed?: number;
            motors?: Array<{
                power: {
                    hourly?: number;  // kW per hour
                    peak?: number;    // kW peak
                };
                code?: string;
            }>;
            transmission?: string;
        };
        electric?: {
            range?: number;          // km
            consumption?: number;    // Wh/km
            emissionClass?: string;
        };
        seating?: {
            total?: number;
            front?: number;
        };
        noise?: {
            level?: number;          // dB
            source?: string;
        };
    };
    error?: string;
    debug?: any;  // For development debugging
}

interface TechnicalData {
    generelt?: {
        merke?: Array<{ merke: string }>;
        handelsbetegnelse?: string[];
    };
    karosseriOgLasteplan?: {
        antallDorer?: number[];
        rFarge?: Array<{ kodeBeskrivelse: string }>;
        karosseritype?: { kodeBeskrivelse: string };
    };
    motorOgDrivverk?: {
        motor?: Array<{
            motorKode?: string;
            drivstoff?: Array<{
                drivstoffKode: {
                    kodeBeskrivelse: string;
                    kodeNavn: string;
                    kodeTypeId: string;
                    kodeVerdi: string;
                    tidligereKodeVerdi: string[];
                };
                maksEffektPrTime?: number;
                maksNettoEffekt?: number;
            }>;
        }>;
        utelukkendeElektriskDrift?: boolean;
        hybridElektriskKjoretoy?: boolean;
        maksimumHastighet?: number[];
        girkassetype?: {
            kodeBeskrivelse: string;
            kodeNavn: string;
            kodeTypeId: string;
            kodeVerdi: string;
            tidligereKodeVerdi: string[];
        };
    };
    dimensjoner?: {
        lengde?: number;
        bredde?: number;
        hoyde?: number;
    };
    vekter?: {
        egenvekt?: number;
        tillattTaklast?: number;
        nyttelast?: number;
        tillattTotalvekt?: number;
        tillattTilhengervektMedBrems?: number;
        tillattTilhengervektUtenBrems?: number;
        tillattVertikalKoplingslast?: number;
        tillattVogntogvekt?: number;
    };
    miljodata?: {
        euroKlasse?: {
            kodeBeskrivelse: string;
            kodeNavn: string;
            kodeTypeId: string;
            kodeVerdi: string;
            tidligereKodeVerdi: string[];
        };
        miljoOgdrivstoffGruppe?: Array<{
            forbrukOgUtslipp?: Array<{
                wltpKjoretoyspesifikk?: {
                    rekkeviddeKmBlandetkjoring?: number;
                    nedcEnergiforbruk?: number;
                };
            }>;
            lyd?: {
                kjorestoy?: number;
                stoyMalingOppgittAv?: {
                    kodeBeskrivelse: string;
                    kodeNavn: string;
                    kodeTypeId: string;
                    kodeVerdi: string;
                    tidligereKodeVerdi: string[];
                };
            };
        }>;
    };
    persontall?: {
        sitteplasserTotalt?: number;
        sitteplasserForan?: number;
    };
}

interface VehicleData {
    kjoretoydataListe?: Array<{
        forstegangsregistrering?: {
            registrertForstegangNorgeDato?: string;
        };
        godkjenning?: {
            tekniskGodkjenning?: {
                tekniskeData: TechnicalData;
            };
        };
    }>;
}

const VEGVESEN_API_URL = 'https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata';

export const GET: RequestHandler = async ({ url }) => {
    try {
        const licensePlate = url.searchParams.get('plate')?.trim();
        
        if (!licensePlate) {
            console.error('Missing license plate parameter');
            return json({ 
                success: false, 
                error: 'License plate is required' 
            } as VehicleResponse);
        }

        if (!STATENS_VEGVESEN_API_KEY) {
            console.error('Missing API key');
            return json({ 
                success: false, 
                error: 'API key is not configured' 
            } as VehicleResponse);
        }

        // Validate license plate format (Norwegian format)
        const licensePlateRegex = /^[A-Z]{2}[0-9]{4,5}$/;
        const formattedPlate = licensePlate.toUpperCase();
        if (!licensePlateRegex.test(formattedPlate)) {
            console.error('Invalid license plate format:', licensePlate);
            return json({ 
                success: false, 
                error: 'Invalid license plate format' 
            } as VehicleResponse);
        }

        console.log('=== Starting vehicle lookup ===');
        console.log('License plate:', formattedPlate);
        console.log('API Key present:', !!STATENS_VEGVESEN_API_KEY);
        
        const requestUrl = `${VEGVESEN_API_URL}?kjennemerke=${encodeURIComponent(formattedPlate)}`;
        
        const response = await fetch(requestUrl, {
            headers: {
                'SVV-Authorization': `Apikey ${STATENS_VEGVESEN_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });

            if (response.status === 404) {
                return json({ 
                    success: false, 
                    error: 'Vehicle not found'
                } as VehicleResponse);
            }

            if (response.status === 429) {
                return json({ 
                    success: false, 
                    error: 'Rate limit exceeded'
                } as VehicleResponse);
            }
            
            return json({ 
                success: false, 
                error: `Failed to fetch vehicle data: ${response.statusText}`,
                debug: {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                }
            } as VehicleResponse);
        }

        const data = await response.json() as VehicleData;
        
        // Extract vehicle data
        const vehicle = data.kjoretoydataListe?.[0];
        if (!vehicle) {
            return json({ 
                success: false, 
                error: 'Vehicle not found',
                debug: data
            } as VehicleResponse);
        }

        const technicalData = vehicle.godkjenning?.tekniskGodkjenning?.tekniskeData;
        if (!technicalData) {
            return json({ 
                success: false, 
                error: 'Technical data not available',
                debug: vehicle
            } as VehicleResponse);
        }

        // Extract all the raw data for debugging
        const rawData = {
            karosseri: {
                doors: technicalData.karosseriOgLasteplan?.antallDorer,
                color: technicalData.karosseriOgLasteplan?.rFarge,
                bodyType: technicalData.karosseriOgLasteplan?.karosseritype
            },
            motor: {
                drivstoff: technicalData.motorOgDrivverk?.motor?.[0]?.drivstoff,
                isElectric: technicalData.motorOgDrivverk?.utelukkendeElektriskDrift,
                isHybrid: technicalData.motorOgDrivverk?.hybridElektriskKjoretoy,
                maxSpeed: technicalData.motorOgDrivverk?.maksimumHastighet,
                drivstoffKode: technicalData.motorOgDrivverk?.motor?.[0]?.drivstoff?.[0]?.drivstoffKode
            },
            dimensions: technicalData.dimensjoner,
            weights: technicalData.vekter,
            complete: technicalData
        };

        console.log('Raw Data:', JSON.stringify(rawData, null, 2));

        // Extract basic info
        const make = technicalData.generelt?.merke?.[0]?.merke;
        const model = technicalData.generelt?.handelsbetegnelse?.[0];
        const firstRegDate = vehicle.forstegangsregistrering?.registrertForstegangNorgeDato;
        const year = firstRegDate ? new Date(firstRegDate).getFullYear() : null;
        const doors = technicalData.karosseriOgLasteplan?.antallDorer?.[0];
        const color = technicalData.karosseriOgLasteplan?.rFarge?.[0]?.kodeBeskrivelse;
        const bodyType = technicalData.karosseriOgLasteplan?.karosseritype?.kodeBeskrivelse;
        
        // Get dimensions and weights
        const dimensions = technicalData.dimensjoner;
        const weights = technicalData.vekter;
        
        // Get motor data
        const motorData = technicalData.motorOgDrivverk;
        const motors = motorData?.motor?.map(motor => ({
            power: {
                hourly: motor.drivstoff?.[0]?.maksEffektPrTime,
                peak: motor.drivstoff?.[0]?.maksNettoEffekt
            },
            code: motor.motorKode
        }));

        // Get environmental data
        const miljoData = technicalData.miljodata?.miljoOgdrivstoffGruppe?.[0];
        const wltpData = miljoData?.forbrukOgUtslipp?.[0]?.wltpKjoretoyspesifikk;
        
        // Get seating data
        const seating = technicalData.persontall;

        // Determine engine type
        let engineType: 'electric' | 'hybrid' | 'conventional' = 'conventional';
        const drivstoffKode = motorData?.motor?.[0]?.drivstoff?.[0]?.drivstoffKode?.kodeBeskrivelse;
        
        if (drivstoffKode === 'Elektrisk' || motorData?.utelukkendeElektriskDrift) {
            engineType = 'electric';
        } else if (motorData?.hybridElektriskKjoretoy) {
            engineType = 'hybrid';
        }

        if (!make || !model || !year) {
            return json({ 
                success: false, 
                error: 'Could not extract required vehicle information',
                debug: rawData
            } as VehicleResponse);
        }

        return json({
            success: true,
            car: {
                make,
                model,
                year,
                doors: doors ? `${doors}-dr` : '5-dr', // Note: Physical doors, excluding trunk
                color,
                bodyType,
                dimensions: dimensions ? {
                    length: dimensions.lengde,
                    width: dimensions.bredde,
                    height: dimensions.hoyde
                } : undefined,
                weight: weights ? {
                    total: weights.egenvekt,
                    maxRoofLoad: weights.tillattTaklast,
                    payload: weights.nyttelast,
                    totalAllowed: weights.tillattTotalvekt,
                    trailerWeight: {
                        withBrakes: weights.tillattTilhengervektMedBrems,
                        withoutBrakes: weights.tillattTilhengervektUtenBrems,
                        verticalLoad: weights.tillattVertikalKoplingslast,
                        totalTrainWeight: weights.tillattVogntogvekt
                    }
                } : undefined,
                engine: {
                    type: engineType,
                    maxSpeed: motorData?.maksimumHastighet?.[0],
                    motors,
                    transmission: motorData?.girkassetype?.kodeBeskrivelse
                },
                electric: engineType === 'electric' ? {
                    range: wltpData?.rekkeviddeKmBlandetkjoring,
                    consumption: wltpData?.nedcEnergiforbruk,
                    emissionClass: technicalData.miljodata?.euroKlasse?.kodeBeskrivelse
                } : undefined,
                seating: seating ? {
                    total: seating.sitteplasserTotalt,
                    front: seating.sitteplasserForan
                } : undefined,
                noise: miljoData?.lyd ? {
                    level: miljoData.lyd.kjorestoy,
                    source: miljoData.lyd.stoyMalingOppgittAv?.kodeBeskrivelse
                } : undefined
            },
            debug: rawData
        } as VehicleResponse);

    } catch (error) {
        console.error('Error in vehicle lookup:', error);
        return json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to process request',
            debug: error instanceof Error ? {
                message: error.message,
                stack: error.stack
            } : error
        } as VehicleResponse, { status: 500 });
    }
} 