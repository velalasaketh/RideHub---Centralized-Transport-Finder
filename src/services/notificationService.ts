import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Configure how notifications are handled when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const ENGAGEMENT_MESSAGES = [
    { title: "Wanna take a ride? 🚗", body: "Find the smartest ride in seconds." },
    { title: "How was your previous ride? ⭐", body: "We'd love to hear your feedback!" },
    { title: "Planning a trip? 📅", body: "Book a cab now and save time." },
    { title: "Need to go somewhere? 📍", body: "Find a ride instantly with RideHub." },
    { title: "Your next ride is just a tap away! 📱", body: "Open the app to see nearby captains." },
];

export const NotificationService = {
    async registerForPushNotificationsAsync() {
        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return null;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            return null;
        }

        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            return token;
        } catch (e) {
            console.error('Error getting push token:', e);
            return null;
        }
    },

    async sendLocalNotification(title: string, body: string, data = {}) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
        });
    },

    async scheduleEngagementNotification() {
        // Cancel any existing scheduled engagement notifications to avoid duplicates
        await Notifications.cancelAllScheduledNotificationsAsync();

        const randomIndex = Math.floor(Math.random() * ENGAGEMENT_MESSAGES.length);
        const message = ENGAGEMENT_MESSAGES[randomIndex];

        // Random delay between 3 and 5 minutes (in seconds)
        const delayInSeconds = Math.floor(Math.random() * (300 - 180 + 1) + 180);

        await Notifications.scheduleNotificationAsync({
            content: {
                ...message,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: delayInSeconds,
            },
        });

        console.log(`Engagement notification scheduled in ${delayInSeconds}s: ${message.title}`);
    },

    async cancelEngagementNotifications() {
        await Notifications.cancelAllScheduledNotificationsAsync();
    }
};
