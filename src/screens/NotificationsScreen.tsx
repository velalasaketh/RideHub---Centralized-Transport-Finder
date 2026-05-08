import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import { ArrowLeft, Bell, BellOff, Info, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { NotificationService } from '../services/notificationService';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export default function NotificationsScreen({ navigation }: Props) {
    const [pushEnabled, setPushEnabled] = useState(true);
    const [rideUpdates, setRideUpdates] = useState(true);
    const [offersEnabled, setOffersEnabled] = useState(false);

    const NotificationItem = ({ icon: Icon, title, subtitle, isSwitch, value, onValueChange, iconColor }: any) => (
        <View style={styles.item}>
            <View style={[styles.iconContainer, { backgroundColor: iconColor || colors.primary50 }]}>
                <Icon size={20} color={iconColor ? '#fff' : colors.primary} />
            </View>
            <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.itemSubtitle}>{subtitle}</Text>
            </View>
            {isSwitch && (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{ false: colors.gray200, true: colors.primary }}
                    thumbColor="#fff"
                />
            )}
        </View>
    );

    const triggerTestNotification = async () => {
        try {
            const token = await NotificationService.registerForPushNotificationsAsync();
            if (!token) {
                // If token is null, permissions might be denied or it's a simulator
                // But we can still send a local one for testing
            }

            NotificationService.sendLocalNotification(
                "RideHub Test! 🚀",
                "This is a test notification. Your ride is working perfectly!"
            );
        } catch (error) {
            Alert.alert('Error', 'Could not trigger notification. Please check permissions.');
        }
    };

    return (
        <ScreenWrapper style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <TouchableOpacity style={styles.testButton} onPress={triggerTestNotification}>
                    <Bell size={20} color="#fff" />
                    <Text style={styles.testButtonText}>Send Test Notification</Text>
                </TouchableOpacity>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Preferences</Text>
                    <NotificationItem
                        icon={Bell}
                        title="Push Notifications"
                        subtitle="Receive updates on your mobile"
                        isSwitch
                        value={pushEnabled}
                        onValueChange={setPushEnabled}
                    />
                    <NotificationItem
                        icon={CheckCircle2}
                        title="Ride Updates"
                        subtitle="Track your ride status"
                        isSwitch
                        value={rideUpdates}
                        onValueChange={setRideUpdates}
                    />
                    <NotificationItem
                        icon={Info}
                        title="Offers & Promos"
                        subtitle="Get discounts and coupons"
                        isSwitch
                        value={offersEnabled}
                        onValueChange={setOffersEnabled}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Recent Activity</Text>
                    <View style={styles.emptyActivity}>
                        <BellOff size={40} color={colors.gray300} strokeWidth={1} />
                        <Text style={styles.emptyText}>No recent notifications</Text>
                    </View>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray100,
    },
    backButton: { marginRight: 16 },
    headerTitle: { ...typography.h3, fontSize: 18, color: colors.textPrimary },
    content: { padding: 20 },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 16,
        gap: 10,
        marginBottom: 32,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    testButtonText: { ...typography.bodyBold, color: colors.white },
    section: { marginBottom: 32 },
    sectionLabel: {
        ...typography.small,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: '700',
        marginBottom: 16
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray50,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primary50,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    itemContent: { flex: 1 },
    itemTitle: { ...typography.bodyBold, color: colors.textPrimary },
    itemSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    emptyActivity: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        backgroundColor: colors.gray50,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.gray100,
    },
    emptyText: { ...typography.body, color: colors.textSecondary, marginTop: 12 },
});
