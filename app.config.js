// Expo handles .env files automatically if they are prefixed with EXPO_PUBLIC_

export default {
    expo: {
        name: "RideHub",
        slug: "ride",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/app_icon.png",
        userInterfaceStyle: "light",
        newArchEnabled: true,
        splash: {
            image: "./assets/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.syam_sundar.ride",
            infoPlist: {
                NSLocationWhenInUseUsageDescription: "RideHub needs your location to set the pickup point for your rides."
            },
            config: {
                googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
            }
        },
        android: {
            package: "com.syam_sundar.ride",
            adaptiveIcon: {
                foregroundImage: "./assets/app_icon.png",
                backgroundColor: "#ffffff"
            },
            permissions: [
                "ACCESS_COARSE_LOCATION",
                "ACCESS_FINE_LOCATION",
                "POST_NOTIFICATIONS"
            ],
            config: {
                googleMaps: {
                    apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
                }
            },
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false
        },
        plugins: [
            [
                "expo-notifications",
                {
                    "icon": "./assets/app_icon.png",
                    "color": "#ffffff"
                }
            ]
        ],
        web: {
            favicon: "./assets/favicon.png"
        },
        extra: {
            eas: {
                projectId: "df71f31a-59c5-4d57-a2f6-96ecc3fc3bfa"
            }
        }
    }
};
