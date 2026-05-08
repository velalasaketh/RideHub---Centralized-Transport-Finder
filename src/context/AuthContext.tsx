import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
    is2FAVerified: boolean;
    setIs2FAVerified: (value: boolean) => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    is2FAVerified: false,
    setIs2FAVerified: () => { },
    isLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [is2FAVerified, setIs2FAVerifiedState] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    const loadStorageData = async () => {
        try {
            const storedValue = await AsyncStorage.getItem('is2FAVerified');
            if (storedValue !== null) {
                setIs2FAVerifiedState(JSON.parse(storedValue));
            }
        } catch (e) {
            // Silently fail
        } finally {
            setIsLoading(false);
        }
    };

    const setIs2FAVerified = async (value: boolean) => {
        setIs2FAVerifiedState(value);
        try {
            await AsyncStorage.setItem('is2FAVerified', JSON.stringify(value));
        } catch (e) {
            // Silently fail
        }
    };

    return (
        <AuthContext.Provider value={{ is2FAVerified, setIs2FAVerified, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
