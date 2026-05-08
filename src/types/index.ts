export interface Coordinate {
    latitude: number;
    longitude: number;
}

export type RootStackParamList = {
    Onboarding: undefined;
    Login: undefined;
    Register: undefined;
    Home: {
        selectedLocation?: string;
        locationType?: 'pickup' | 'drop';
        coordinates?: Coordinate;
    } | undefined;
    RideComparison: {
        pickup: string;
        drop: string;
        pickupCoords?: Coordinate;
        dropCoords?: Coordinate;
        distanceKm?: number;
        distanceText?: string;
        durationText?: string;
    };
    BookingConfirmation: {
        ride: any;
        pickup?: string;
        drop?: string;
        pickupCoords?: Coordinate;
        dropCoords?: Coordinate;
        durationText?: string;
        highestFare?: number;
    };
    RideStatus: {
        rideId: string;
        initialStatus: string;
        paymentMethod?: string;
    };
    RideHistory: undefined;
    LocationSearch: {
        type: 'pickup' | 'drop';
    };
    Profile: undefined;
    Notifications: undefined;
    PrivacySecurity: undefined;
    PaymentMethods: undefined;
    RideCompleted: { rideId: string };
};

export interface User {
    uid: string;
    email: string | null;
    displayName?: string | null;
}
