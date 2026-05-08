import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    ActivityIndicator,
    Dimensions,
    Image,
    Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import { generateRideOptions, RideOption, VehicleType, generateMockDrivers, MockDriver } from '../utils/simulation';
import {
    ArrowLeft,
    Star,
    Zap,
    Filter,
    CarFront,
    Bike,
    Car,
    Route,
    Clock,
    Check,
    Users,
    ChevronRight,
    Wallet,
    CreditCard,
    CircleDollarSign,
    Tag,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'RideComparison'>;

export default function RideComparisonScreen({ route, navigation }: Props) {
    const { pickup, drop, distanceKm, distanceText, durationText, pickupCoords, dropCoords } = route.params;
    const [rides, setRides] = useState<RideOption[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<VehicleType | 'All'>('All');
    const [mockDrivers, setMockDrivers] = useState<MockDriver[]>([]);
    const [sortBy, setSortBy] = useState<'Cheapest' | 'Fastest' | 'Best Rated' | 'None'>('None');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Wallet' | 'UPI' | 'Card'>('Cash');
    const [showOffers, setShowOffers] = useState(false);
    const mapRef = useRef<MapView>(null);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const selectAnim = useRef(new Animated.Value(0)).current;

    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    useEffect(() => {
        if (pickupCoords) {
            setMockDrivers(generateMockDrivers(pickupCoords.latitude, pickupCoords.longitude, 3));
        }

        setTimeout(() => {
            const options = generateRideOptions(distanceKm);
            setRides(options);
            setLoading(false);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();
        }, 800);
    }, []);

    // Movement Simulation
    useEffect(() => {
        if (mockDrivers.length === 0) return;

        const interval = setInterval(() => {
            setMockDrivers(prev => prev.map(driver => ({
                ...driver,
                latitude: driver.latitude + (Math.random() - 0.5) * 0.0001,
                longitude: driver.longitude + (Math.random() - 0.5) * 0.0001,
                rotation: driver.rotation + (Math.random() - 0.5) * 2,
            })));
        }, 3000); // Move every 3 seconds for "slow" feel

        return () => clearInterval(interval);
    }, [mockDrivers.length]);

    useEffect(() => {
        if (!loading && mapRef.current) {
            const coords = [];
            if (pickupCoords) coords.push(pickupCoords);
            if (dropCoords) coords.push(dropCoords);

            if (coords.length > 0) {
                setTimeout(() => {
                    mapRef.current?.fitToCoordinates(coords, {
                        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                        animated: true,
                    });
                }, 500);
            }
        }
    }, [loading]);

    // Animate bottom panel when selection changes
    useEffect(() => {
        Animated.spring(selectAnim, {
            toValue: selected ? 1 : 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();
    }, [selected]);

    const filtered = filter === 'All' ? rides : rides.filter(r => r.type === filter);

    const sortedRides = [...filtered].sort((a, b) => {
        if (sortBy === 'Cheapest') return a.fare - b.fare;
        if (sortBy === 'Fastest') return a.eta - b.eta;
        if (sortBy === 'Best Rated') return b.rating - a.rating;
        return 0;
    });

    const getTypeIcon = (type: VehicleType) => {
        switch (type) {
            case 'Bike': return <Bike size={20} color={colors.primary} />;
            case 'Auto': return <CarFront size={20} color={colors.warning} />;
            case 'Cab Economy': return <Car size={20} color={colors.success} />;
            case 'Cab Premium': return <Car size={20} color={colors.primary} />;
        }
    };

    const handleBook = () => {
        if (!selected) return;
        const ride = rides.find(r => r.id === selected);
        if (ride) {
            const highestFare = Math.max(...rides.map(r => r.fare));
            navigation.navigate('BookingConfirmation', {
                ride,
                pickup,
                drop,
                pickupCoords,
                dropCoords,
                durationText,
                highestFare,
            });
        }
    };

    if (loading) {
        return (
            <ScreenWrapper style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Finding best rides for you...</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Available Rides</Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {pickup} → {drop}
                    </Text>
                </View>
            </View>

            {/* Distance Info */}
            {(distanceText || durationText) && (
                <View style={styles.distanceBanner}>
                    {distanceText && (
                        <View style={styles.distancePill}>
                            <Route size={14} color={colors.primary} />
                            <Text style={styles.distancePillText}>{distanceText}</Text>
                        </View>
                    )}
                    {durationText && (
                        <View style={styles.distancePill}>
                            <Clock size={14} color={colors.primary} />
                            <Text style={styles.distancePillText}>{durationText}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Map Preview - Enlarged */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: pickupCoords?.latitude || 12.9716,
                        longitude: pickupCoords?.longitude || 77.5946,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    customMapStyle={mapStyle}
                >
                    {pickupCoords && dropCoords && (
                        <MapViewDirections
                            origin={pickupCoords}
                            destination={dropCoords}
                            apikey={GOOGLE_MAPS_API_KEY}
                            strokeWidth={4}
                            strokeColor={colors.primary}
                            optimizeWaypoints={true}
                            onReady={result => {
                                mapRef.current?.fitToCoordinates(result.coordinates, {
                                    edgePadding: {
                                        right: width / 10,
                                        bottom: 50,
                                        left: width / 10,
                                        top: 50,
                                    },
                                });
                            }}
                        />
                    )}
                    {pickupCoords && (
                        <Marker coordinate={pickupCoords} title="Pickup">
                            <View style={styles.markerCircle}>
                                <View style={styles.markerInner} />
                            </View>
                        </Marker>
                    )}
                    {dropCoords && (
                        <Marker coordinate={dropCoords} title="Drop">
                            <View style={[styles.markerCircle, { backgroundColor: colors.error + '33' }]}>
                                <View style={[styles.markerInner, { backgroundColor: colors.error }]} />
                            </View>
                        </Marker>
                    )}
                    {mockDrivers.map(driver => (
                        <Marker
                            key={driver.id}
                            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                            flat
                            anchor={{ x: 0.5, y: 0.5 }}
                            rotation={driver.rotation}
                            tracksViewChanges={true}
                        >
                            <View style={styles.driverMarker}>
                                {driver.type === 'Bike' ? (
                                    <Bike size={22} color={colors.primary} fill={colors.primary} />
                                ) : driver.type === 'Auto' ? (
                                    <CarFront size={22} color={colors.warning} fill={colors.warning} />
                                ) : (
                                    <Car size={22} color={colors.success} fill={colors.success} />
                                )}
                            </View>
                        </Marker>
                    ))}
                </MapView>
            </View>

            {/* Filter & Sort Bar */}
            <View style={styles.controlsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
                    {(['All', 'Bike', 'Auto', 'Cab Economy', 'Cab Premium'] as const).map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.filterChip, filter === t && styles.filterChipActive]}
                            onPress={() => setFilter(t)}
                        >
                            <Text style={[styles.filterChipText, filter === t && styles.filterChipTextActive]}>
                                {t}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortBar} contentContainerStyle={styles.sortBarContent}>
                    {(['Cheapest', 'Fastest', 'Best Rated'] as const).map((s) => (
                        <TouchableOpacity
                            key={s}
                            style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
                            onPress={() => setSortBy(sortBy === s ? 'None' : s)}
                        >
                            <Text style={[styles.sortChipText, sortBy === s && styles.sortChipTextActive]}>
                                {s}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Ride List */}
            <View style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
                    {sortedRides.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Filter size={40} color={colors.gray300} strokeWidth={1} />
                            <Text style={styles.emptyText}>No rides match this filter</Text>
                        </View>
                    ) : (
                        sortedRides.map((ride) => (
                            <TouchableOpacity
                                key={ride.id}
                                style={[styles.rideCard, selected === ride.id && styles.rideCardSelected]}
                                onPress={() => setSelected(ride.id)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.rideBadgeContainer}>
                                    {ride.isCheapest && (
                                        <View style={[styles.badge, { backgroundColor: colors.success }]}>
                                            <Text style={styles.badgeText}>Cheapest</Text>
                                        </View>
                                    )}
                                    {ride.isFastest && (
                                        <View style={[styles.badge, { backgroundColor: colors.info }]}>
                                            <Text style={styles.badgeText}>Fastest</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.rideCardMain}>
                                    <View style={[styles.providerLogoContainer, { backgroundColor: ride.type.includes('Cab') ? colors.primary50 : ride.type === 'Auto' ? colors.warning50 : colors.success50 }]}>
                                        {getTypeIcon(ride.type)}
                                    </View>

                                    <View style={styles.rideInfoGroup}>
                                        <Text style={styles.rideNameText}>{ride.name}</Text>
                                        <View style={styles.rideDetailsRow}>
                                            <View style={styles.miniDetail}>
                                                <Users size={12} color={colors.textTertiary} />
                                                <Text style={styles.miniDetailText}>{ride.capacity}</Text>
                                            </View>
                                            <View style={styles.miniDetail}>
                                                <Clock size={12} color={colors.textTertiary} />
                                                <Text style={styles.miniDetailText}>{ride.eta} mins away</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.dropTimeText}>Drop by {ride.dropTime}</Text>
                                    </View>

                                    <View style={styles.priceGroup}>
                                        <Text style={styles.priceAmountText}>₹{ride.fare}</Text>
                                        {ride.isSurge && (
                                            <View style={styles.surgeIndicator}>
                                                <Zap size={10} color={colors.error} fill={colors.error} />
                                                <Text style={styles.surgeMultiplierText}>{ride.surgeMultiplier}x</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                    {/* Offers Section */}
                    <View style={styles.offerSection}>
                        <TouchableOpacity style={styles.offerButton} onPress={() => setShowOffers(!showOffers)}>
                            <View style={styles.offerLeft}>
                                <Tag size={18} color={colors.primary} />
                                <Text style={styles.offerText}>Apply Coupon / Offers</Text>
                            </View>
                            <ChevronRight size={18} color={colors.gray400} style={{ transform: [{ rotate: showOffers ? '90deg' : '0deg' }] }} />
                        </TouchableOpacity>

                        {showOffers && (
                            <View style={styles.offersList}>
                                {[
                                    { code: 'FIRST50', desc: '50% off on your first ride' },
                                    { code: 'WEEKEND', desc: 'Flat ₹30 off on Cabs' }
                                ].map((offer) => (
                                    <TouchableOpacity key={offer.code} style={styles.offerCard}>
                                        <View>
                                            <Text style={styles.offerCode}>{offer.code}</Text>
                                            <Text style={styles.offerDesc}>{offer.desc}</Text>
                                        </View>
                                        <View style={styles.applyBadge}>
                                            <Text style={styles.applyText}>APPLY</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Payment Selector */}
                    <View style={styles.paymentSection}>
                        <Text style={styles.sectionTitle}>Payment Method</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.paymentScroll}>
                            {(['Cash', 'Wallet', 'UPI', 'Card'] as const).map((method) => (
                                <TouchableOpacity
                                    key={method}
                                    style={[styles.paymentChip, paymentMethod === method && styles.paymentChipActive]}
                                    onPress={() => setPaymentMethod(method)}
                                >
                                    {method === 'Cash' && <CircleDollarSign size={16} color={paymentMethod === method ? colors.white : colors.textSecondary} />}
                                    {method === 'Wallet' && <Wallet size={16} color={paymentMethod === method ? colors.white : colors.textSecondary} />}
                                    {method === 'UPI' && <Zap size={16} color={paymentMethod === method ? colors.white : colors.textSecondary} />}
                                    {method === 'Card' && <CreditCard size={16} color={paymentMethod === method ? colors.white : colors.textSecondary} />}
                                    <Text style={[styles.paymentChipText, paymentMethod === method && styles.paymentChipTextActive]}>{method}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </ScrollView>
            </View>

            {/* Bottom Confirmation Panel */}
            <Animated.View style={[
                styles.confirmationPanel,
                { transform: [{ translateY: selectAnim.interpolate({ inputRange: [0, 1], outputRange: [220, 0] }) }] }
            ]}>
                {selected && (() => {
                    const selectedRide = rides.find(r => r.id === selected);
                    return (
                        <View style={styles.panelContent}>
                            <View style={styles.panelHeader}>
                                <View style={[styles.panelLogoBg, { backgroundColor: colors.primary50 }]}>
                                    {getTypeIcon(selectedRide?.type as VehicleType)}
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.panelRideName}>{selectedRide?.name}</Text>
                                    <Text style={styles.panelRideMeta}>{selectedRide?.eta} min away • Paying via {paymentMethod}</Text>
                                </View>
                                <View style={styles.panelPriceContainer}>
                                    <Text style={styles.panelPrice}>₹{selectedRide?.fare}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.mainBookButton}
                                onPress={handleBook}
                                activeOpacity={0.9}
                            >
                                <Text style={styles.mainBookButtonText}>Book {selectedRide?.type}</Text>
                            </TouchableOpacity>
                        </View>
                    );
                })()}
            </Animated.View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray100,
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        ...typography.h3,
        fontSize: 18,
        color: colors.textPrimary,
    },
    headerSubtitle: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    distanceBanner: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 10,
        backgroundColor: colors.white,
    },
    distancePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: colors.gray50,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.gray100,
    },
    distancePillText: {
        ...typography.small,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    mapContainer: {
        height: 280,
        backgroundColor: colors.gray100,
        marginHorizontal: 0,
        borderRadius: 0,
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderBottomColor: colors.gray100,
        marginBottom: 0,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    controlsWrapper: {
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray100,
        paddingBottom: 8,
    },
    filterBar: {
        height: 54,
        flexGrow: 0,
    },
    filterBarContent: {
        paddingLeft: 20,
        paddingRight: 20,
        paddingVertical: 10,
        gap: 10,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: colors.gray50,
        borderWidth: 1,
        borderColor: colors.gray100,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        ...typography.small,
        color: colors.textSecondary,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: colors.white,
    },
    sortBar: {
        height: 48,
        flexGrow: 0,
    },
    sortBarContent: {
        paddingLeft: 20,
        paddingRight: 20,
        paddingVertical: 6,
        gap: 8,
    },
    sortChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.gray200,
    },
    sortChipActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary50,
    },
    sortChipText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    sortChipTextActive: {
        color: colors.primary,
    },
    listContent: {
        padding: 16,
        paddingBottom: 240, // More space for panel
    },
    rideCard: {
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: colors.gray100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    rideCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primary50,
    },
    rideBadgeContainer: {
        flexDirection: 'row',
        position: 'absolute',
        top: -8,
        left: 12,
        gap: 6,
        zIndex: 10,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    badgeText: {
        color: colors.white,
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    rideCardMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerLogoContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.gray100,
    },
    rideInfoGroup: {
        flex: 1,
        marginLeft: 14,
    },
    rideNameText: {
        ...typography.bodyBold,
        fontSize: 15,
        color: colors.textPrimary,
    },
    rideDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 10,
    },
    miniDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    miniDetailText: {
        ...typography.caption,
        color: colors.textTertiary,
        fontWeight: '700',
    },
    dropTimeText: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
        marginTop: 2,
    },
    priceGroup: {
        alignItems: 'flex-end',
    },
    priceAmountText: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    surgeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    surgeMultiplierText: {
        fontSize: 10,
        color: colors.error,
        fontWeight: '700',
        marginLeft: 2,
    },
    offerSection: {
        marginTop: 12,
    },
    offerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.white,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.gray100,
    },
    offersList: {
        marginTop: 8,
        gap: 8,
    },
    offerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.primary50,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary100,
        borderStyle: 'dashed',
    },
    offerCode: {
        ...typography.bodyBold,
        fontSize: 13,
        color: colors.primary,
    },
    offerDesc: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    applyBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    applyText: {
        color: colors.white,
        fontSize: 10,
        fontWeight: '800',
    },
    offerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    offerText: {
        ...typography.body,
        fontSize: 14,
        fontWeight: '600',
    },
    paymentSection: {
        marginTop: 20,
    },
    sectionTitle: {
        ...typography.h4,
        fontSize: 14,
        marginBottom: 12,
        color: colors.textPrimary,
    },
    paymentScroll: {
        height: 44,
    },
    paymentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: colors.gray50,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: colors.gray100,
        gap: 6,
    },
    paymentChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    paymentChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    paymentChipTextActive: {
        color: colors.white,
    },
    confirmationPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.white,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
        zIndex: 1000,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    panelContent: {
        padding: 24,
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    panelLogoBg: {
        width: 60,
        height: 60,
        borderRadius: 15,
        backgroundColor: colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    panelLogo: {
        width: 44,
        height: 44,
    },
    panelRideName: {
        ...typography.h3,
        fontSize: 18,
    },
    panelRideMeta: {
        ...typography.body,
        fontSize: 14,
        color: colors.textSecondary,
    },
    panelPriceContainer: {
        alignItems: 'flex-end',
    },
    panelPrice: {
        fontSize: 24,
        fontWeight: '900',
        color: colors.primary,
    },
    mainBookButton: {
        backgroundColor: colors.primary,
        width: '100%',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    mainBookButtonText: {
        ...typography.button,
        color: colors.white,
        fontSize: 18,
        fontWeight: '800',
    },
    markerCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary + '33',
        justifyContent: 'center',
        alignItems: 'center',
    },
    markerInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
        borderWidth: 2,
        borderColor: colors.white,
    },
    driverMarker: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

const mapStyle = [
    {
        "featureType": "poi",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "transit",
        "stylers": [{ "visibility": "off" }]
    }
];
