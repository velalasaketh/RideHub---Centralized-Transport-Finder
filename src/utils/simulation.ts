export interface Provider {
    id: string;
    name: 'CityMove' | 'UrbanRide' | 'Ridezy';
    icon: string;
}

export type VehicleType = 'Bike' | 'Auto' | 'Cab Economy' | 'Cab Premium';

export interface RideOption {
    id: string;
    provider: Provider;
    fare: number;
    eta: number; // minutes to arrive
    duration: number; // minutes to destination
    dropTime: string; // e.g. "11:45 PM"
    rating: number;
    isSurge: boolean;
    surgeMultiplier: number;
    capacity: number;
    score: number;
    isRecommended: boolean;
    isCheapest?: boolean;
    isFastest?: boolean;
    type: VehicleType;
    name: string;
}

export interface MockDriver {
    id: string;
    type: VehicleType;
    latitude: number;
    longitude: number;
    rotation: number;
}

export const PROVIDERS: Provider[] = [
    { id: '1', name: 'CityMove', icon: 'car' },
    { id: '2', name: 'UrbanRide', icon: 'taxi' },
    { id: '3', name: 'Ridezy', icon: 'bike' },
];

// Per-km rates for each vehicle type (in ₹)
const RATES: Record<VehicleType, { base: number; perKm: number; capacity: number }> = {
    Bike: { base: 25, perKm: 7, capacity: 1 },
    Auto: { base: 30, perKm: 12, capacity: 3 },
    'Cab Economy': { base: 50, perKm: 16, capacity: 4 },
    'Cab Premium': { base: 80, perKm: 22, capacity: 4 },
};

export const generateRideOptions = (distanceKm?: number): RideOption[] => {
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20);
    const randomDemand = Math.random() > 0.7;
    const isSurge = isPeakHour || randomDemand;

    const km = distanceKm && distanceKm > 0 ? distanceKm : 5 + Math.random() * 10;
    const options: RideOption[] = [];

    const now = new Date();

    PROVIDERS.forEach((provider) => {
        const types: VehicleType[] = ['Bike', 'Auto', 'Cab Economy', 'Cab Premium'];

        types.forEach((type) => {
            const rate = RATES[type];
            const surgeMultiplier = isSurge ? parseFloat((Math.random() * (1.5 - 1.1) + 1.1).toFixed(1)) : 1;

            const providerVariance = 0.85 + Math.random() * 0.3;
            const rawFare = (rate.base + rate.perKm * km) * providerVariance * surgeMultiplier;
            const fare = Math.round(rawFare);

            const speedKmPerMin = type === 'Bike' ? 0.8 : type === 'Auto' ? 0.6 : 0.5;
            const eta = Math.max(2, Math.round(km / speedKmPerMin * 0.2 + Math.random() * 5)); // Driver arrival
            const duration = Math.round(km / speedKmPerMin + Math.random() * 5); // Trip duration

            const dropTimeDate = new Date(now.getTime() + (eta + duration) * 60000);
            const dropTime = dropTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const rating = parseFloat((Math.random() * (5.0 - 4.1) + 4.1).toFixed(1));

            const normFare = 1 - (fare / 800);
            const normEta = 1 - (eta / 20);
            const normRating = rating / 5;
            const score = (0.5 * normFare) + (0.3 * normEta) + (0.2 * normRating);

            options.push({
                id: Math.random().toString(36).substr(2, 9),
                provider,
                fare,
                eta,
                duration,
                dropTime,
                rating,
                isSurge,
                surgeMultiplier,
                capacity: rate.capacity,
                score,
                isRecommended: false,
                type,
                name: type === 'Cab Economy' || type === 'Cab Premium' ? type : `${provider.name} ${type}`,
            });
        });
    });

    const minFare = Math.min(...options.map(o => o.fare));
    const minEta = Math.min(...options.map(o => o.eta));
    const maxScore = Math.max(...options.map(o => o.score));

    return options.map(o => ({
        ...o,
        isCheapest: o.fare === minFare,
        isFastest: o.eta === minEta,
        isRecommended: o.score === maxScore
    })).sort((a, b) => b.score - a.score);
};

export const generateMockDrivers = (centerLat: number, centerLng: number, count: number = 3): MockDriver[] => {
    const drivers: MockDriver[] = [];
    const types: VehicleType[] = ['Bike', 'Auto', 'Cab Economy'];
    // Fixed distances in meters: 500m, 1km, 1.5km
    const distances = [500, 1000, 1500];

    for (let i = 0; i < Math.min(count, 3); i++) {
        // Random angle in radians (full 360°)
        const angle = Math.random() * 2 * Math.PI;
        const distMeters = distances[i] || (150 + Math.random() * 200);

        // Convert meters to lat/lng offset
        // 1 degree latitude ≈ 111,320 meters
        // 1 degree longitude ≈ 111,320 * cos(latitude) meters
        const latOffset = (distMeters * Math.cos(angle)) / 111320;
        const lngOffset = (distMeters * Math.sin(angle)) / (111320 * Math.cos(centerLat * Math.PI / 180));

        // Calculate rotation to face toward pickup (for realism)
        const facingAngle = (angle * 180 / Math.PI + 180) % 360;

        drivers.push({
            id: `driver-${i}-${Math.random().toString(36).substr(2, 5)}`,
            type: types[i % types.length],
            latitude: centerLat + latOffset,
            longitude: centerLng + lngOffset,
            rotation: facingAngle,
        });
    }
    return drivers;
};
