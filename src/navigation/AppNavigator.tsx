import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { ActivityIndicator, View, AppState, AppStateStatus } from "react-native";
import { colors } from "../theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NotificationService } from "../services/notificationService";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import RideComparisonScreen from "../screens/RideComparisonScreen";
import BookingConfirmationScreen from "../screens/BookingConfirmationScreen";
import RideStatusScreen from "../screens/RideStatusScreen";
import RideHistoryScreen from "../screens/RideHistoryScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import LocationSearchScreen from "../screens/LocationSearchScreen";
import ProfileScreen from "../screens/ProfileScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import PrivacySecurityScreen from "../screens/PrivacySecurityScreen";
import PaymentMethodsScreen from "../screens/PaymentMethodsScreen";
import RideCompletedScreen from "../screens/RideCompletedScreen";

import { RootStackParamList } from "../types";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { RideProvider } from "../context/RideContext";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppStack() {
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
    const { is2FAVerified, setIs2FAVerified, isLoading: isAuthLoading } = useAuth();

    useEffect(() => {
        let isMounted = true;

        // Load onboarding state first
        const initAsync = async () => {
            try {
                const value = await AsyncStorage.getItem('hasSeenOnboarding');
                if (isMounted) setHasSeenOnboarding(value === 'true');
            } catch (e) {
                if (isMounted) setHasSeenOnboarding(false);
            }
        };

        // Listen for auth state
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (isMounted) {
                setUser(u);
                // We don't force reset is2FAVerified here anymore, allowing persistence
                setAuthReady(true);
            }
        });

        // Initial notification setup
        NotificationService.registerForPushNotificationsAsync();

        // Background engagement listener
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState.match(/inactive|background/)) {
                // App went to background - schedule engagement notification
                NotificationService.scheduleEngagementNotification();
            } else if (nextAppState === 'active') {
                // App came to foreground - cancel any pending engagement notifications
                NotificationService.cancelEngagementNotifications();
            }
        });

        initAsync();

        return () => {
            isMounted = false;
            unsubscribe();
            subscription.remove();
        };
    }, []);

    // Wait for auth, onboarding, and persistent state check to resolve
    if (!authReady || hasSeenOnboarding === null || isAuthLoading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            {user && is2FAVerified ? (
                <Stack.Group>
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="RideComparison" component={RideComparisonScreen} />
                    <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
                    <Stack.Screen name="RideStatus" component={RideStatusScreen} />
                    <Stack.Screen name="RideHistory" component={RideHistoryScreen} />
                    <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                    <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
                    <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
                    <Stack.Screen name="RideCompleted" component={RideCompletedScreen} />
                </Stack.Group>
            ) : (
                <Stack.Group>
                    {!hasSeenOnboarding && (
                        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    )}
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                </Stack.Group>
            )}
        </Stack.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <AuthProvider>
            <RideProvider>
                <NavigationContainer>
                    <AppStack />
                </NavigationContainer>
            </RideProvider>
        </AuthProvider>
    );
}
