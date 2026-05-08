import React, { createContext, useState, useContext } from 'react';
import { Coordinate } from '../types';

interface RideContextType {
    pickup: string;
    drop: string;
    pickupCoords: Coordinate | null;
    dropCoords: Coordinate | null;
    setPickup: (value: string) => void;
    setDrop: (value: string) => void;
    setPickupCoords: (coords: Coordinate | null) => void;
    setDropCoords: (coords: Coordinate | null) => void;
    clearRide: () => void;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export const RideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pickup, setPickup] = useState('');
    const [drop, setDrop] = useState('');
    const [pickupCoords, setPickupCoords] = useState<Coordinate | null>(null);
    const [dropCoords, setDropCoords] = useState<Coordinate | null>(null);

    const clearRide = () => {
        setPickup('');
        setDrop('');
        setPickupCoords(null);
        setDropCoords(null);
    };

    return (
        <RideContext.Provider
            value={{
                pickup,
                drop,
                pickupCoords,
                dropCoords,
                setPickup,
                setDrop,
                setPickupCoords,
                setDropCoords,
                clearRide,
            }}
        >
            {children}
        </RideContext.Provider>
    );
};

export const useRide = () => {
    const context = useContext(RideContext);
    if (!context) {
        throw new Error('useRide must be used within a RideProvider');
    }
    return context;
};
