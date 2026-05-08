import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import { ArrowLeft, Clock, MapPin, Car, Calendar, ChevronRight } from 'lucide-react-native';
import { auth, db } from '../services/firebaseConfig';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'RideHistory'>;

interface RideRecord {
    id: string;
    provider: string;
    type: string;
    fare: number;
    pickup: string;
    drop: string;
    status: string;
    timestamp: number;
}

export default function RideHistoryScreen({ navigation }: Props) {
    const [rides, setRides] = useState<RideRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const fadeAnim = useState(new Animated.Value(0))[0];

    useEffect(() => {
        fetchRides();
    }, []);

    const fetchRides = async () => {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        try {
            const q = query(
                collection(db, 'bookings'),
                where('userId', '==', user.uid),
                orderBy('timestamp', 'desc')
            );
            const snap = await getDocs(q);
            const data: RideRecord[] = [];
            snap.forEach((doc) => {
                const d = doc.data();
                data.push({
                    id: doc.id,
                    provider: d.provider || 'Unknown',
                    type: d.type || 'Cab',
                    fare: d.fare || 0,
                    pickup: d.pickup || 'Pickup',
                    drop: d.drop || 'Drop',
                    status: d.status || 'completed',
                    timestamp: d.timestamp || Date.now(),
                });
            });
            setRides(data);
        } catch (e) {
            // Silently fail
        } finally {
            setLoading(false);
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        }
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return colors.success;
            case 'cancelled': return colors.error;
            default: return colors.primary;
        }
    };

    return (
        <ScreenWrapper style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ride History</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {rides.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Clock size={48} color={colors.gray300} strokeWidth={1} />
                                <Text style={styles.emptyTitle}>No rides yet</Text>
                                <Text style={styles.emptyText}>Your completed rides will show up here.</Text>
                            </View>
                        ) : (
                            rides.map((ride) => (
                                <View key={ride.id} style={styles.rideCard}>
                                    <View style={styles.rideCardHeader}>
                                        <View style={styles.providerIcon}>
                                            <Car size={20} color={colors.primary} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.providerName}>{ride.provider}</Text>
                                            <View style={styles.dateRow}>
                                                <Calendar size={12} color={colors.textTertiary} />
                                                <Text style={styles.dateText}>{formatDate(ride.timestamp)}</Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.fareText}>₹{ride.fare}</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(ride.status)}15` }]}>
                                                <Text style={[styles.statusText, { color: getStatusColor(ride.status) }]}>
                                                    {ride.status}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.routeSection}>
                                        <View style={styles.routeRow}>
                                            <View style={styles.routeDot} />
                                            <Text style={styles.routeText} numberOfLines={1}>{ride.pickup}</Text>
                                        </View>
                                        <View style={styles.routeConnector} />
                                        <View style={styles.routeRow}>
                                            <View style={[styles.routeDot, styles.routeDotSquare]} />
                                            <Text style={styles.routeText} numberOfLines={1}>{ride.drop}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </ScrollView>
                </Animated.View>
            )}
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    emptyState: { alignItems: 'center', paddingVertical: 80 },
    emptyTitle: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 16 },
    emptyText: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
    rideCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: colors.gray100,
    },
    rideCardHeader: { flexDirection: 'row', alignItems: 'center' },
    providerIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: colors.primary50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    providerName: { ...typography.bodyBold, fontSize: 15, color: colors.textPrimary },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    dateText: { ...typography.caption, color: colors.textTertiary },
    fareText: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
    statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    routeSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.gray100 },
    routeRow: { flexDirection: 'row', alignItems: 'center' },
    routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 12 },
    routeDotSquare: { borderRadius: 1.5, backgroundColor: colors.success },
    routeConnector: { width: 1.5, height: 16, backgroundColor: colors.gray200, marginLeft: 3.5 },
    routeText: { ...typography.body, color: colors.textSecondary, flex: 1 },
});
