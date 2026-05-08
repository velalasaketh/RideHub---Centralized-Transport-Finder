import { Coordinate } from '../types';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface DistanceMatrixResult {
    distance: string; // e.g. "1.2 km"
    duration: string; // e.g. "5 mins"
    distanceValue: number; // in meters
    durationValue: number; // in seconds
}

export const calculateDistance = async (
    origin: Coordinate,
    destination: Coordinate
): Promise<DistanceMatrixResult | null> => {
    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.latitude},${origin.longitude}&destinations=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
            const element = data.rows[0].elements[0];
            return {
                distance: element.distance.text,
                duration: element.duration.text,
                distanceValue: element.distance.value,
                durationValue: element.duration.value,
            };
        }

        // Handle or report error
        return null;
    } catch (error) {
        // Distance matrix fetch error
        return null;
    }
};
