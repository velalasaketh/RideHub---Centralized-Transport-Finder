import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    TouchableOpacity,
    Animated,
    ScrollView,
    RefreshControl,
    Image,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import ScreenWrapper from '../components/ScreenWrapper';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { auth } from '../services/firebaseConfig';
import {
    MapPin,
    History,
    Home,
    Briefcase,
    Navigation,
    Clock,
    ChevronRight,
    Search,
    Package,
    Car,
    Route,
    User,
    Bike,
    CarFront,
    ArrowUpDown,
    Star,
} from 'lucide-react-native';
import { calculateDistance, DistanceMatrixResult } from '../services/googleMapsService';
import { db } from '../services/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useRide } from '../context/RideContext';
import { generateMockDrivers, MockDriver } from '../utils/simulation';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface RecentRide {
    id: string;
    pickup: string;
    drop: string;
    date: string;
}

export default function HomeScreen() {
    const {
        pickup, setPickup,
        drop, setDrop,
        pickupCoords, setPickupCoords,
        dropCoords, setDropCoords
    } = useRide();

    const [distanceResult, setDistanceResult] = useState<DistanceMatrixResult | null>(null);
    const [loadingDistance, setLoadingDistance] = useState(false);
    const [recentRides, setRecentRides] = useState<RecentRide[]>([]);
    const [userName, setUserName] = useState('');
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [savedPlaces, setSavedPlaces] = useState<{ home?: string; work?: string }>({});

    const fadeAnim = useState(new Animated.Value(0))[0];
    const slideAnim = useState(new Animated.Value(20))[0];
    const section1Anim = useState(new Animated.Value(0))[0];
    const section2Anim = useState(new Animated.Value(0))[0];
    const section3Anim = useState(new Animated.Value(0))[0];
    const section4Anim = useState(new Animated.Value(0))[0];
    const scaleValue = useState(new Animated.Value(1))[0];

    const navigation = useNavigation<NavigationProp>();

    // Calculate distance when both coords are available
    useEffect(() => {
        const fetchDistance = async () => {
            if (pickupCoords && dropCoords) {
                setLoadingDistance(true);
                const result = await calculateDistance(pickupCoords, dropCoords);
                setDistanceResult(result);
                setLoadingDistance(false);
            }
        };
        fetchDistance();
    }, [pickupCoords, dropCoords]);

    useEffect(() => {
        const user = auth.currentUser;
        if (user) {
            setUserName(user.displayName || 'Friend');
            fetchRecentRides(user.uid);
        }

        // Auto-fill pickup with current location
        if (!pickup) {
            handleLocationAccess();
        }

        // Load saved places
        loadSavedPlaces();

        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]).start();

        Animated.stagger(150, [
            Animated.timing(section1Anim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(section2Anim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(section3Anim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(section4Anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        const user = auth.currentUser;
        if (user) {
            await fetchRecentRides(user.uid);
        }
        // Simulated delay for better UX
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    const fetchRecentRides = async (uid: string) => {
        try {
            const ridesRef = collection(db, 'bookings');
            let rides: RecentRide[] = [];
            try {
                // Try with orderBy (needs composite index)
                const q = query(
                    ridesRef,
                    where('userId', '==', uid),
                    orderBy('timestamp', 'desc'),
                    limit(5)
                );
                const querySnapshot = await getDocs(q);
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    rides.push({
                        id: doc.id,
                        pickup: data.pickup,
                        drop: data.drop,
                        date: new Date(data.timestamp).toLocaleDateString()
                    });
                });
            } catch {
                // Fallback: query without orderBy if index not available
                const q = query(
                    ridesRef,
                    where('userId', '==', uid),
                    limit(10)
                );
                const querySnapshot = await getDocs(q);
                const allRides: RecentRide[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    allRides.push({
                        id: doc.id,
                        pickup: data.pickup,
                        drop: data.drop,
                        date: new Date(data.timestamp || Date.now()).toLocaleDateString()
                    });
                });
                // Sort manually and take latest 5
                rides = allRides.sort((a, b) => {
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                }).slice(0, 5);
            }
            setRecentRides(rides);
        } catch (error) {
            // Silently fail
        }
    };

    const handleLocationAccess = async () => {
        if (loadingLocation) return;
        setLoadingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable location permissions to use this feature.');
                setLoadingLocation(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;
            setPickupCoords({ latitude, longitude });

            let response = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (response.length > 0) {
                const address = response[0];
                const parts = [
                    address.name,
                    address.street,
                    address.city
                ].filter(part => part && part !== 'Unnamed Road').join(', ');
                setPickup(parts || 'Current Location');
            } else {
                setPickup('Current Location');
            }
        } catch (error) {
            Alert.alert('Location Error', 'Could not fetch your current location.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleSwap = () => {
        const tempPickup = pickup;
        const tempPickupCoords = pickupCoords;
        setPickup(drop);
        setPickupCoords(dropCoords);
        setDrop(tempPickup);
        setDropCoords(tempPickupCoords);
    };

    const loadSavedPlaces = async () => {
        try {
            const home = await AsyncStorage.getItem('savedPlace_home');
            const work = await AsyncStorage.getItem('savedPlace_work');
            setSavedPlaces({ home: home || undefined, work: work || undefined });
        } catch (error) {
            console.error('Error loading saved places:', error);
        }
    };

    const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_PLACES_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const loc = data.results[0].geometry?.location;
                if (loc) return { latitude: loc.lat, longitude: loc.lng };
            }
        } catch { }
        return null;
    };

    const handleSavedPlace = async (placeType: 'home' | 'work') => {
        const address = placeType === 'home' ? savedPlaces.home : savedPlaces.work;
        if (address) {
            setDrop(address);
            // Geocode the saved address to get coordinates
            const coords = await geocodeAddress(address);
            if (coords) {
                setDropCoords(coords);
            }
        } else {
            Alert.alert(
                `Set ${placeType === 'home' ? 'Home' : 'Work'} Address`,
                `You haven't saved your ${placeType} address yet. Would you like to set it now?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Set Address',
                        onPress: () => navigation.navigate('LocationSearch', { type: 'drop' }),
                    },
                ]
            );
        }
    };

    const handleSearch = async () => {
        if (!pickup || !drop) {
            Alert.alert('Missing Details', 'Please enter both pickup and drop locations.');
            return;
        }

        // Geocode drop if coordinates are missing (e.g. from Home/Work quick access)
        let finalDropCoords = dropCoords;
        if (!finalDropCoords && drop) {
            const coords = await geocodeAddress(drop);
            if (coords) {
                finalDropCoords = coords;
                setDropCoords(coords);
            }
        }

        // Geocode pickup if coordinates are missing
        let finalPickupCoords = pickupCoords;
        if (!finalPickupCoords && pickup) {
            const coords = await geocodeAddress(pickup);
            if (coords) {
                finalPickupCoords = coords;
                setPickupCoords(coords);
            }
        }

        const distanceKm = distanceResult ? distanceResult.distanceValue / 1000 : undefined;

        navigation.navigate('RideComparison', {
            pickup,
            drop,
            pickupCoords: finalPickupCoords || undefined,
            dropCoords: finalDropCoords || undefined,
            distanceKm,
            distanceText: distanceResult?.distance,
            durationText: distanceResult?.duration,
        });
    };

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getContextualGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'Where are you headed today?';
        if (hour >= 12 && hour < 17) return 'Need a ride somewhere?';
        if (hour >= 17 && hour < 21) return 'Heading home?';
        return 'Late night ride?';
    };

    return (
        <ScreenWrapper style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Header */}
                <View style={styles.topHeader}>
                    <Image source={require('../../assets/ridehub_text.png')} style={styles.headerLogo} resizeMode="contain" />
                    <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
                        <User size={22} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Greeting Section */}
                <Animated.View style={[styles.greetingSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <Text style={styles.greetingText}>{getTimeGreeting()}, {userName} 👋</Text>
                    <Text style={styles.subGreetingText}>{getContextualGreeting()}</Text>
                </Animated.View>

                {/* Quick Access Section */}
                <Animated.View style={{ marginBottom: 24, opacity: section1Anim, transform: [{ translateY: section1Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                    <Text style={styles.sectionLabel}>Quick Access</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAccessScroll}>
                        <TouchableOpacity style={styles.pill} onPress={handleLocationAccess} disabled={loadingLocation}>
                            {loadingLocation ? <ActivityIndicator size="small" color={colors.primary} /> : <Navigation size={16} color={colors.primary} />}
                            <Text style={styles.pillText}>{loadingLocation ? 'Fetching...' : 'Current Location'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.pill} onPress={() => handleSavedPlace('home')}>
                            <Home size={16} color={savedPlaces.home ? colors.primary : colors.textSecondary} />
                            <Text style={styles.pillText}>{savedPlaces.home ? 'Home' : '+ Home'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.pill} onPress={() => handleSavedPlace('work')}>
                            <Briefcase size={16} color={savedPlaces.work ? colors.primary : colors.textSecondary} />
                            <Text style={styles.pillText}>{savedPlaces.work ? 'Work' : '+ Work'}</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </Animated.View>

                {/* Search Card */}
                <Animated.View style={[styles.searchCard, { opacity: section2Anim, transform: [{ translateY: section2Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                    <View style={styles.inputWrapper}>
                        <View style={styles.locationFields}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.inputContainer}>
                                    <View style={styles.dotIndicator} />
                                    <TouchableOpacity style={styles.inputTouchable} onPress={() => navigation.navigate('LocationSearch', { type: 'pickup' })}>
                                        <Text style={[styles.inputText, !pickup && styles.placeholderText]} numberOfLines={1}>
                                            {pickup || "Pickup Location"}
                                        </Text>
                                    </TouchableOpacity>
                                    {!loadingLocation ? (
                                        <TouchableOpacity onPress={handleLocationAccess} style={styles.gpsButton}>
                                            <Navigation size={16} color={colors.primary} />
                                        </TouchableOpacity>
                                    ) : (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                    )}
                                </View>

                                <View style={styles.routeLine}><View style={styles.routeLineDash} /></View>

                                <TouchableOpacity
                                    style={[styles.inputContainer, styles.dropContainer]}
                                    onPress={() => navigation.navigate('LocationSearch', { type: 'drop' })}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.dotIndicator, styles.dotSquare]} />
                                    <Text style={[styles.inputText, styles.dropText, !drop && styles.dropPlaceholderText]} numberOfLines={1}>
                                        {drop || "Where to?"}
                                    </Text>
                                    <Search size={18} color={drop ? colors.textTertiary : colors.primary} style={{ marginLeft: 8, flexShrink: 0 }} />
                                </TouchableOpacity>
                            </View>

                            {/* Swap Button */}
                            {(pickup || drop) && (
                                <TouchableOpacity style={styles.swapButton} onPress={handleSwap} activeOpacity={0.7}>
                                    <ArrowUpDown size={16} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Quick Destination Suggestions */}
                    {!drop && (
                        <View style={styles.quickDestinations}>
                            <Text style={styles.quickDestLabel}>Popular Destinations</Text>
                            {[
                                { name: 'Airport', icon: '✈️' },
                                { name: 'Railway Station', icon: '🚆' },
                                { name: 'Bus Stand', icon: '🚌' },
                                { name: 'Mall', icon: '🛍️' },
                            ].map((dest) => (
                                <TouchableOpacity
                                    key={dest.name}
                                    style={styles.quickDestItem}
                                    onPress={() => {
                                        setDrop(dest.name);
                                        navigation.navigate('LocationSearch', { type: 'drop' });
                                    }}
                                >
                                    <Text style={styles.quickDestEmoji}>{dest.icon}</Text>
                                    <Text style={styles.quickDestText}>{dest.name}</Text>
                                    <ChevronRight size={14} color={colors.gray400} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {distanceResult && (
                        <View style={styles.distanceInfo}>
                            <View style={styles.infoChip}>
                                <Route size={14} color={colors.primary} />
                                <Text style={styles.infoChipText}>{distanceResult.distance}</Text>
                            </View>
                            <View style={styles.infoChip}>
                                <Clock size={14} color={colors.primary} />
                                <Text style={styles.infoChipText}>{distanceResult.duration}</Text>
                            </View>
                        </View>
                    )}

                    {loadingDistance && (
                        <View style={styles.distanceLoading}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.distanceLoadingText}>Calculating route...</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.searchButton, (!pickup || !drop || loadingDistance) && styles.searchButtonDisabled]}
                        onPress={handleSearch}
                        disabled={!pickup || !drop || loadingDistance}
                    >
                        <Search size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Search Rides</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Explore Section */}
                <Animated.View style={{ opacity: section3Anim, transform: [{ translateY: section3Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                    <Text style={styles.sectionLabel}>Explore Services</Text>
                    <View style={styles.exploreContainer}>
                        <TouchableOpacity style={styles.serviceCard} onPress={() => navigation.navigate('LocationSearch', { type: 'drop' })}>
                            <View style={[styles.serviceIconContainer, { backgroundColor: colors.primary50 }]}>
                                <Bike size={26} color={colors.primary} strokeWidth={2} />
                            </View>
                            <Text style={styles.serviceTitle}>Bike</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.serviceCard} onPress={() => navigation.navigate('LocationSearch', { type: 'drop' })}>
                            <View style={[styles.serviceIconContainer, { backgroundColor: '#FEF3C7' }]}>
                                <CarFront size={26} color={colors.warning} strokeWidth={2} />
                            </View>
                            <Text style={styles.serviceTitle}>Auto</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.serviceCard} onPress={() => navigation.navigate('LocationSearch', { type: 'drop' })}>
                            <View style={[styles.serviceIconContainer, { backgroundColor: '#D1FAE5' }]}>
                                <Car size={26} color={colors.success} strokeWidth={2} />
                            </View>
                            <Text style={styles.serviceTitle}>Cab Economy</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.serviceCard} onPress={() => navigation.navigate('LocationSearch', { type: 'drop' })}>
                            <View style={[styles.serviceIconContainer, { backgroundColor: '#CFFAFE' }]}>
                                <Bike size={26} color={colors.info} strokeWidth={2} />
                            </View>
                            <Text style={styles.serviceTitle}>Cab Premium</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>


                {/* Recent Rides Section */}
                <Animated.View style={[{ marginTop: 28, opacity: section4Anim, transform: [{ translateY: section4Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>Recent Rides</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('RideHistory')}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    {recentRides.length > 0 ? (
                        recentRides.map((ride) => (
                            <TouchableOpacity key={ride.id} style={styles.recentRideCard} onPress={() => { setPickup(ride.pickup); setDrop(ride.drop); }}>
                                <View style={styles.recentRideIcon}><Clock size={18} color={colors.textSecondary} /></View>
                                <View style={styles.recentRideInfo}>
                                    <Text style={styles.recentRideText} numberOfLines={1}>{ride.drop}</Text>
                                    <Text style={styles.recentRideSubtext} numberOfLines={1}>{ride.pickup}</Text>
                                </View>
                                <ChevronRight size={18} color={colors.gray300} />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <History size={40} color={colors.gray300} strokeWidth={1} style={{ marginBottom: 12 }} />
                            <Text style={styles.emptyStateTitle}>No rides yet</Text>
                            <Text style={styles.emptyStateText}>Your ride history will appear here after booking.</Text>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 24, paddingBottom: 40 },
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
    headerLogo: { width: 140, height: 40 },
    profileButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary50, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary100 },
    greetingSection: { marginTop: 16, marginBottom: 28 },
    greetingText: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
    subGreetingText: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
    searchCard: { backgroundColor: colors.card, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: colors.gray100, marginBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 8 },
    inputWrapper: { gap: 0 },
    locationFields: { flexDirection: 'row', alignItems: 'center' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.gray50, borderRadius: 16, borderWidth: 1, borderColor: colors.gray100 },
    dropContainer: { backgroundColor: colors.primary + '08', borderColor: colors.primary + '30', borderWidth: 1.5, overflow: 'hidden' },
    dotIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginRight: 14 },
    dotSquare: { borderRadius: 2, backgroundColor: colors.success },
    inputTouchable: { flex: 1 },
    inputText: { ...typography.bodyBold, fontSize: 15, color: colors.textPrimary },
    dropText: { fontSize: 16, flex: 1 },
    placeholderText: { color: colors.textTertiary, fontWeight: '400' },
    dropPlaceholderText: { color: colors.primary, fontWeight: '600', opacity: 0.7 },
    gpsButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primary50, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    swapButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary50, justifyContent: 'center', alignItems: 'center', marginLeft: 10, borderWidth: 1.5, borderColor: colors.primary100 },
    routeLine: { paddingLeft: 20, height: 16, justifyContent: 'center' },
    routeLineDash: { width: 1.5, height: '100%', backgroundColor: colors.gray200 },
    quickDestinations: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 14 },
    quickDestLabel: { ...typography.small, color: colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    quickDestItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    quickDestEmoji: { fontSize: 18, width: 28 },
    quickDestText: { ...typography.body, color: colors.textPrimary, fontWeight: '600', flex: 1 },
    distanceInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 10 },
    infoChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary50, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, gap: 6 },
    infoChipText: { ...typography.small, color: colors.primary700, fontWeight: '700' },
    distanceLoading: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.gray50, borderRadius: 12 },
    distanceLoadingText: { ...typography.small, color: colors.textSecondary, marginLeft: 10 },
    searchButton: { backgroundColor: colors.primary, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginTop: 16 },
    searchButtonDisabled: { opacity: 0.5 },
    buttonText: { ...typography.button, color: colors.white, fontSize: 16 },
    sectionLabel: { ...typography.small, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700', marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    seeAllText: { ...typography.small, color: colors.primary, fontWeight: '700' },
    exploreContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
    serviceCard: { alignItems: 'center' },
    serviceIconContainer: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    serviceTitle: { ...typography.caption, fontWeight: '700', color: colors.textPrimary, fontSize: 13 },
    quickAccessScroll: { paddingRight: 20, marginBottom: 4 },
    pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50, marginRight: 10, borderWidth: 1, borderColor: colors.gray100 },
    pillText: { ...typography.small, color: colors.textPrimary, marginLeft: 8, fontWeight: '600' },
    recentRideCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.gray100 },
    recentRideIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: colors.gray100 },
    recentRideInfo: { flex: 1 },
    recentRideText: { ...typography.bodyBold, fontSize: 15, color: colors.textPrimary },
    recentRideSubtext: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    emptyState: { paddingVertical: 40, alignItems: 'center', backgroundColor: colors.gray50, borderRadius: 20, borderWidth: 1, borderColor: colors.gray100 },
    emptyStateTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 4 },
    emptyStateText: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
});
