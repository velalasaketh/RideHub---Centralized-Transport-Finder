import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    Alert,
    TextInput,
    Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import {
    ArrowLeft,
    User,
    Mail,
    Phone,
    Settings,
    LogOut,
    CreditCard,
    Bell,
    Shield,
    ChevronRight,
    Clock,
    Edit3,
    X,
    RotateCcw,
    Car,
} from 'lucide-react-native';
import { auth, db } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
    const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [stats, setStats] = useState({ rides: 0, hours: 0, saved: 0 });
    const fadeAnim = useState(new Animated.Value(0))[0];
    const { setIs2FAVerified } = useAuth();

    useEffect(() => {
        fetchProfile();
        fetchStats();
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const fetchProfile = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfile({
                    name: data.name || user.displayName || '',
                    email: data.email || user.email || '',
                    phone: data.phone || '',
                });
            } else {
                setProfile({
                    name: user.displayName || '',
                    email: user.email || '',
                    phone: '',
                });
            }
        } catch (e) {
            // Silently fail
        }
    };

    const fetchStats = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const bookingsRef = collection(db, 'bookings');
            const q = query(bookingsRef, where('userId', '==', user.uid));
            const snap = await getDocs(q);

            let totalRides = 0;
            let totalMinutes = 0;
            let totalSaved = 0;

            snap.forEach(docSnap => {
                const data = docSnap.data();
                totalRides++;

                // Calculate hours from duration text like "25 mins" or timestamp diff
                if (data.durationText) {
                    const mins = parseInt(data.durationText);
                    if (!isNaN(mins)) totalMinutes += mins;
                } else if (data.duration) {
                    totalMinutes += Number(data.duration) || 0;
                }

                // Saved = difference between highest and selected fare
                if (data.savedAmount) {
                    totalSaved += Number(data.savedAmount) || 0;
                } else if (data.fare && data.highestFare) {
                    totalSaved += (Number(data.highestFare) - Number(data.fare)) || 0;
                }
            });

            const totalHours = Math.round((totalMinutes / 60) * 10) / 10; // 1 decimal
            setStats({
                rides: totalRides,
                hours: totalHours,
                saved: Math.round(totalSaved),
            });
        } catch (e) {
            // Silently fail
        }
    };

    const handleSaveProfile = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                name: editName,
                phone: editPhone,
            });
            setProfile(prev => ({ ...prev, name: editName, phone: editPhone }));
            setEditModalVisible(false);
        } catch (e) {
            Alert.alert('Error', 'Could not update profile.');
        }
    };

    const handleLogout = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    await signOut(auth);
                    setIs2FAVerified(false); // Explicitly clear 2FA state
                },
            },
        ]);
    };

    const handleResetOnboarding = async () => {
        await AsyncStorage.removeItem('hasSeenOnboarding');
        Alert.alert('Done', 'Onboarding will show on next app restart.');
    };

    const openEditModal = () => {
        setEditName(profile.name);
        setEditPhone(profile.phone);
        setEditModalVisible(true);
    };

    const SettingsItem = ({ icon: IconComponent, label, onPress, color, showArrow = true }: any) => (
        <TouchableOpacity style={styles.settingsItem} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.settingsIcon, color && { backgroundColor: `${color}15` }]}>
                <IconComponent size={18} color={color || colors.textSecondary} />
            </View>
            <Text style={[styles.settingsLabel, color === colors.error && { color: colors.error }]}>{label}</Text>
            {showArrow && <ChevronRight size={16} color={colors.gray300} />}
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={openEditModal}>
                    <Edit3 size={20} color={colors.primary} />
                </TouchableOpacity>
            </View>

            <Animated.ScrollView
                style={{ opacity: fadeAnim }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarCircle}>
                        <User size={36} color={colors.primary} />
                    </View>
                    <Text style={styles.profileName}>{profile.name || 'User'}</Text>
                    <Text style={styles.profileEmail}>{profile.email}</Text>
                    {profile.phone ? (
                        <View style={styles.phoneBadge}>
                            <Phone size={12} color={colors.primary} />
                            <Text style={styles.phoneText}>{profile.phone}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Car size={20} color={colors.primary} />
                        <Text style={styles.statValue}>{stats.rides}</Text>
                        <Text style={styles.statLabel}>Rides</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Clock size={20} color={colors.warning} />
                        <Text style={styles.statValue}>{stats.hours}</Text>
                        <Text style={styles.statLabel}>Hours</Text>
                    </View>
                    <View style={styles.statCard}>
                        <CreditCard size={20} color={colors.success} />
                        <Text style={styles.statValue}>{stats.saved > 0 ? `₹${stats.saved}` : '0'}</Text>
                        <Text style={styles.statLabel}>Saved</Text>
                    </View>
                </View>

                {/* Settings */}
                <Text style={styles.sectionLabel}>Settings</Text>
                <View style={styles.settingsCard}>
                    <SettingsItem icon={Bell} label="Notifications" color={colors.primary} onPress={() => navigation.navigate('Notifications')} />
                    <View style={styles.separator} />
                    <SettingsItem icon={Shield} label="Privacy & Security" color={colors.info} onPress={() => navigation.navigate('PrivacySecurity')} />
                    <View style={styles.separator} />
                    <SettingsItem icon={CreditCard} label="Payment Methods" color={colors.success} onPress={() => navigation.navigate('PaymentMethods')} />
                    <View style={styles.separator} />
                    <SettingsItem icon={RotateCcw} label="Reset Onboarding" color={colors.warning} onPress={handleResetOnboarding} />
                </View>

                {/* Logout */}
                <View style={styles.settingsCard}>
                    <SettingsItem
                        icon={LogOut}
                        label="Sign Out"
                        color={colors.error}
                        onPress={handleLogout}
                        showArrow={false}
                    />
                </View>
            </Animated.ScrollView>

            {/* Edit Modal */}
            <Modal visible={editModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Name</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Your name"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Phone</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editPhone}
                                onChangeText={setEditPhone}
                                placeholder="+91 98765 43210"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} activeOpacity={0.9}>
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    headerTitle: { ...typography.h3, fontSize: 18, color: colors.textPrimary, flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    profileCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.gray100,
        marginBottom: 20,
    },
    avatarCircle: {
        width: 80,
        height: 80,
        borderRadius: 28,
        backgroundColor: colors.primary50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.primary100,
    },
    profileName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
    profileEmail: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
    phoneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary50,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
        marginTop: 12,
        gap: 6,
    },
    phoneText: { ...typography.small, color: colors.primary, fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    statCard: {
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.gray100,
    },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
    statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    sectionLabel: {
        ...typography.small,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: '700',
        marginBottom: 12,
    },
    settingsCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.gray100,
        marginBottom: 16,
        overflow: 'hidden',
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    settingsIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        backgroundColor: colors.gray50,
    },
    settingsLabel: { flex: 1, ...typography.body, color: colors.textPrimary, fontWeight: '600' },
    separator: { height: 1, backgroundColor: colors.gray100, marginLeft: 66 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    inputGroup: { marginBottom: 16 },
    inputLabel: { ...typography.small, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
    modalInput: {
        backgroundColor: colors.gray50,
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 52,
        ...typography.body,
        color: colors.textPrimary,
        borderWidth: 1.5,
        borderColor: colors.gray200,
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    saveButtonText: { ...typography.button, color: colors.white, fontSize: 16 },
});
