import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
    Alert,
    SafeAreaView,
    StatusBar,
    Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import {
    Phone,
    Star,
    MessageCircle,
    User,
    Shield,
    X,
    Navigation,
    MapPin,
    Copy,
    MoreHorizontal,
    RefreshCw,
} from 'lucide-react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { NotificationService } from '../services/notificationService';

type Props = NativeStackScreenProps<RootStackParamList, 'RideStatus'>;

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const STATUSES = {
    finding_driver: { label: 'Finding Captain...', sub: 'Connecting nearby', color: colors.warning },
    driver_assigned: { label: 'Captain Assigned', sub: 'Arriving in 2 mins', color: colors.info },
    on_the_way: { label: 'Heading to Drop', sub: 'On the way', color: colors.primary },
    arrived: { label: 'Captain Arrived', sub: 'Waiting at pickup', color: colors.success },
    completed: { label: 'Ride Completed', sub: 'Thank you!', color: colors.success },
};

export default function RideStatusScreen({ route, navigation }: Props) {
    const { rideId, initialStatus } = route.params;
    const [status, setStatus] = useState(initialStatus || 'finding_driver');
    const [otp, setOtp] = useState('');
    const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [dropLocation, setDropLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [driverRotation, setDriverRotation] = useState(0);
    const [rideType, setRideType] = useState<string>('cab');
    const [driverInfo, setDriverInfo] = useState({ name: 'Rajesh Kumar', vehicle: 'White Swift Dzire • KA 05 MV 2341' });

    const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
    const mapRef = useRef<MapView>(null);
    const [activeRoute, setActiveRoute] = useState<{ origin: any, destination: any } | null>(null);
    const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);

    // Animations
    const radarAnim = useRef(new Animated.Value(0)).current;
    const bottomSheetAnim = useRef(new Animated.Value(height)).current;

    // Movement ref
    const movementInterval = useRef<NodeJS.Timeout | null>(null);
    const hasMovedToPickup = useRef(false);
    const hasMovedToDrop = useRef(false);

    useEffect(() => {
        // Generate random 4-digit OTP
        setOtp(Math.floor(1000 + Math.random() * 9000).toString());

        // Fetch Ride Details and Coordinates
        const fetchRideDetails = async () => {
            const docRef = doc(db, 'bookings', rideId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.type) setRideType(data.type.toLowerCase());

                let pLoc = null;
                let dLoc = null;

                // Load Pickup Location
                if (data.pickupCoordinates) {
                    pLoc = {
                        latitude: data.pickupCoordinates.latitude,
                        longitude: data.pickupCoordinates.longitude
                    };
                    setUserLocation(pLoc);
                }


                // Load Drop Location
                if (data.dropCoordinates) {
                    dLoc = {
                        latitude: data.dropCoordinates.latitude,
                        longitude: data.dropCoordinates.longitude
                    };
                    setDropLocation(dLoc);
                }


                // Start driver slightly away from pickup
                if (pLoc) {
                    const startLat = pLoc.latitude + 0.005; // approx 500m
                    const startLng = pLoc.longitude + 0.005;
                    const driverStart = { latitude: startLat, longitude: startLng };

                    setDriverLocation(driverStart);
                    setDriverRotation(calculateBearing(startLat, startLng, pLoc.latitude, pLoc.longitude));

                    // Set dynamic driver info based on type
                    const typeStr = data.type?.toLowerCase() || 'cab';
                    if (typeStr.includes('bike') || typeStr.includes('moto')) {
                        setDriverInfo({ name: 'Arun Singh', vehicle: 'Royal Enfield Classic • KA 03 JB 8821' });
                    } else if (typeStr.includes('auto')) {
                        setDriverInfo({ name: 'Suresh Babu', vehicle: 'Bajaj RE Auto • KA 01 TR 4492' });
                    } else {
                        setDriverInfo({ name: 'Rajesh Kumar', vehicle: 'White Swift Dzire • KA 05 MV 2341' });
                    }
                }
            } else {
                // Booking document not found
            }
        };
        fetchRideDetails();

        // Radar Animation
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(radarAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(radarAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
            ])
        );
        pulse.start();

        return () => {
            pulse.stop();
            if (movementInterval.current) clearInterval(movementInterval.current);
        };
    }, []);

    const isValidCoordinate = (coord: any) => {
        if (!coord) return false;
        if (typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number') return false;
        if (isNaN(coord.latitude) || isNaN(coord.longitude)) return false;
        if (coord.latitude < -90 || coord.latitude > 90) return false;
        if (coord.longitude < -180 || coord.longitude > 180) return false;
        return true;
    };

    // Track which status already set its route (prevent infinite re-setting)
    const lastStatusRouteSet = useRef<string>('');
    // Track which status the current activeRoute was set for
    const routeForStatus = useRef<string>('');

    // State Machine & Logic Control
    useEffect(() => {
        // 5. Completed — handle FIRST, before any null guards
        if (status === 'completed') {
            if (movementInterval.current) clearInterval(movementInterval.current);
            navigation.replace('RideCompleted', { rideId });
            return;
        }

        // 1. Searching -> Driver Assigned
        if (status === 'finding_driver') {
            if (lastStatusRouteSet.current !== 'finding_driver') {
                if (isValidCoordinate(userLocation) && isValidCoordinate(dropLocation)) {
                    routeForStatus.current = 'finding_driver';
                    setActiveRoute({ origin: userLocation, destination: dropLocation });
                    lastStatusRouteSet.current = 'finding_driver';
                }
            }
            // Simulate finding driver after 4s
            const timer = setTimeout(() => {
                updateRideStatus('driver_assigned');
            }, 4000);
            return () => clearTimeout(timer);
        }

        // Show bottom sheet for all post-finding states
        Animated.spring(bottomSheetAnim, { toValue: 0, damping: 15, useNativeDriver: true }).start();

        // Only set route ONCE per status change
        if (lastStatusRouteSet.current === status) return;

        // 2. Driver Assigned -> Arrived
        if (status === 'driver_assigned') {
            if (isValidCoordinate(driverLocation) && isValidCoordinate(userLocation)) {
                routeForStatus.current = 'driver_assigned';
                setActiveRoute({ origin: driverLocation, destination: userLocation });
                lastStatusRouteSet.current = 'driver_assigned';
            }
        }

        // 3. Arrived -> On The Way (Ride Started)
        if (status === 'arrived') {
            if (movementInterval.current) clearInterval(movementInterval.current);
            if (isValidCoordinate(userLocation) && isValidCoordinate(dropLocation)) {
                routeForStatus.current = 'arrived';
                setActiveRoute({ origin: userLocation, destination: dropLocation });
                lastStatusRouteSet.current = 'arrived';
            }
        }

        // 4. On The Way -> Completed
        if (status === 'on_the_way') {
            if (isValidCoordinate(userLocation) && isValidCoordinate(dropLocation)) {
                routeForStatus.current = 'on_the_way';
                setActiveRoute({ origin: userLocation, destination: dropLocation });
                lastStatusRouteSet.current = 'on_the_way';
            }
        }

    }, [status, userLocation, dropLocation, driverLocation]);

    // Handle Route Ready & Animation Trigger
    const onRouteReady = (result: any) => {
        // IMPORTANT: Ignore stale route results from previous statuses
        if (routeForStatus.current !== status) return;

        setRouteCoordinates(result.coordinates);
        fitMapData(result.coordinates);

        // Trigger animation based on status and if we haven't moved yet
        if (status === 'driver_assigned' && !hasMovedToPickup.current) {
            hasMovedToPickup.current = true;
            startSimulation(result.coordinates, userLocation!, 'arrived');
        }
        else if (status === 'on_the_way' && !hasMovedToDrop.current) {
            hasMovedToDrop.current = true;
            startSimulation(result.coordinates, dropLocation!, 'completed');
        }
    };

    // Haversine Distance Calculation (Meters)
    const getDistanceFromLatLonInMm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        var R = 6371; // Radius of the earth in km
        var dLat = deg2rad(lat2 - lat1);
        var dLon = deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        return d * 1000; // Distance in meters
    }

    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180)
    }

    const startSimulation = (path: any[], target: { latitude: number, longitude: number }, nextStatus: string) => {
        if (!path || path.length === 0) return;

        let pointIndex = 0;
        const totalPoints = path.length;
        const totalDuration = 10000; // 10s travel time
        const intervalTime = totalDuration / totalPoints;

        if (movementInterval.current) clearInterval(movementInterval.current);

        movementInterval.current = setInterval(() => {
            if (pointIndex >= totalPoints - 1) {
                if (movementInterval.current) clearInterval(movementInterval.current);
                setDriverLocation(path[totalPoints - 1]);
                updateRideStatus(nextStatus);
                return;
            }

            const nextPoint = path[pointIndex + 1];
            const currentPoint = path[pointIndex];

            if (isValidCoordinate(nextPoint) && isValidCoordinate(currentPoint)) {
                const newRotation = calculateBearing(
                    currentPoint.latitude,
                    currentPoint.longitude,
                    nextPoint.latitude,
                    nextPoint.longitude
                );
                setDriverRotation(newRotation);
                setDriverLocation(nextPoint);

                // Distance Check
                const dist = getDistanceFromLatLonInMm(
                    nextPoint.latitude, nextPoint.longitude,
                    target.latitude, target.longitude
                );
                setDistanceToTarget(dist);

                // Auto-Transition if < 30m
                if (dist < 30) {
                    if (movementInterval.current) clearInterval(movementInterval.current);
                    updateRideStatus(nextStatus);
                    return; // important to stop here
                }
            }

            pointIndex++;
        }, intervalTime);
    };

    const fitMapData = (coords?: any[]) => {
        if (!mapRef.current || !coords) return;
        mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
            animated: true,
        });
    };

    const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
        const startLatRad = (startLat * Math.PI) / 180;
        const startLngRad = (startLng * Math.PI) / 180;
        const destLatRad = (destLat * Math.PI) / 180;
        const destLngRad = (destLng * Math.PI) / 180;

        const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
        const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
            Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
        const brng = Math.atan2(y, x);
        const brngDeg = (brng * 180) / Math.PI;
        return (brngDeg + 360) % 360;
    };

    const updateRideStatus = async (newStatus: string) => {
        setStatus(newStatus);

        // Map status to notification content
        const notificationMessages: Record<string, { title: string, body: string }> = {
            'driver_assigned': { title: 'Captain Assigned', body: 'Your captain is on the way to pick you up.' },
            'arrived': { title: 'Captain Arrived', body: 'Your captain is waiting at the pickup location.' },
            'on_the_way': { title: 'Ride Started', body: 'You are on the way to your destination.' },
            'completed': { title: 'Ride Completed', body: 'You have arrived. Thank you for riding with RideHub!' }
        };

        if (notificationMessages[newStatus]) {
            const { title, body } = notificationMessages[newStatus];
            NotificationService.sendLocalNotification(title, body);
        }

        try {
            await updateDoc(doc(db, 'bookings', rideId), { status: newStatus });
        } catch (e) {
            // Silently fail in production or use a logging service
        }
    };

    const handleStartRide = () => {
        updateRideStatus('on_the_way');
    };

    const handleCancel = () => {
        Alert.alert('Cancel Ride', 'Are you sure you want to cancel?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: () => navigation.navigate('Home')
            }
        ]);
    };

    const getVehicleImage = () => {
        if (rideType.includes('bike') || rideType.includes('moto')) {
            return { uri: 'https://cdn-icons-png.flaticon.com/512/3305/3305602.png' }; // Top view bike
        }
        if (rideType.includes('auto')) {
            return { uri: 'https://cdn-icons-png.flaticon.com/512/2554/2554936.png' }; // Auto rickshaw styled
        }
        // Default Car (White/Premium)
        return { uri: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png' };
    };

    // Radar View (Finding Driver)
    // We still render map in background or just radar?
    // User requested: "If ride status = “Searching” → origin = userLocation → destination = dropCoordinates"
    // This implies they want to see the route on the map BEHIND the radar? 
    // Or is "Search" a map view?
    // Standard apps show "Finding" over the map.
    // I will return the Full View with Radar Overlay if status is Finding, 
    // to allow MapViewDirections to render the initial route.

    const currentStatus = STATUSES[status as keyof typeof STATUSES];

    // Live Tracking View
    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            {/* Map Section */}
            {isValidCoordinate(userLocation) && isValidCoordinate(dropLocation) ? (
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                        latitudeDelta: 0.015,
                        longitudeDelta: 0.015,
                    }}
                    customMapStyle={[]}
                >
                    {/* User Marker */}
                    <Marker coordinate={userLocation} title="Pickup" anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                        <View style={styles.pinContainer}>
                            <View style={[styles.pinDot, { backgroundColor: colors.success }]} />
                            <View style={styles.pinStem} />
                        </View>
                    </Marker>

                    {/* Drop Marker */}
                    <Marker coordinate={dropLocation} title="Drop" anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                        <View style={styles.pinContainer}>
                            <View style={[styles.pinDot, { backgroundColor: colors.error }]} />
                            <View style={styles.pinStem} />
                        </View>
                    </Marker>

                    {/* Driver Marker - Simple Arrow */}
                    {status !== 'finding_driver' && isValidCoordinate(driverLocation) && (
                        <Marker
                            coordinate={driverLocation}
                            title="Captain"
                            rotation={driverRotation}
                            flat={true}
                            anchor={{ x: 0.5, y: 0.5 }}
                            tracksViewChanges={status === 'driver_assigned' || status === 'on_the_way'}
                        >
                            <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                <Navigation size={32} color={colors.primary} fill={colors.primary} />
                            </View>
                        </Marker>
                    )}

                    {/* Dynamic Directions */}
                    {activeRoute && routeForStatus.current === status && isValidCoordinate(activeRoute.origin) && isValidCoordinate(activeRoute.destination) && (
                        <MapViewDirections
                            key={status} // Force remount and refetch so onReady fires on status changes
                            origin={activeRoute.origin}
                            destination={activeRoute.destination}
                            apikey={GOOGLE_MAPS_API_KEY}
                            strokeWidth={5}
                            strokeColor={colors.primary}
                            optimizeWaypoints={false}
                            onReady={onRouteReady}
                        />
                    )}
                </MapView>
            ) : (
                <View style={styles.mapPlaceholder} />
            )}

            {/* Radar Overlay for Finding Driver */}
            {status === 'finding_driver' && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 20 }]}>
                    <View style={styles.radarContainer}>
                        <View style={styles.radarCircle}>
                            <Animated.View style={[styles.radarPulse, {
                                transform: [{ scale: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 4] }) }],
                                opacity: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] })
                            }]} />
                            <View style={styles.radarCore}>
                                <User size={40} color={colors.white} />
                            </View>
                        </View>
                        <Text style={styles.radarText}>Finding nearest captains...</Text>
                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Back Button */}
            <SafeAreaView style={styles.topOverlay}>
                <TouchableOpacity style={styles.circleButton} onPress={() => navigation.goBack()}>
                    <X size={24} color={colors.textPrimary} />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Bottom Sheet */}
            <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: bottomSheetAnim }] }]}>

                {/* 1. Status Header */}
                <View style={styles.statusHeader}>
                    <View style={styles.statusLeft}>
                        <View style={styles.statusIndicator}>
                            <View style={[styles.pulsingDot, { backgroundColor: currentStatus?.color }]} />
                        </View>
                        <View>
                            <Text style={styles.statusTitle}>{currentStatus?.label}</Text>
                            <Text style={styles.statusSub}>
                                {status === 'driver_assigned' && distanceToTarget ? `${Math.round(distanceToTarget)}m away` : currentStatus?.sub}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 2. Driver Info */}
                <View style={styles.driverCard}>
                    <View style={styles.driverAvatar}>
                        <User size={30} color={colors.textSecondary} />
                    </View>
                    <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>{driverInfo.name}</Text>
                        <Text style={styles.vehicleText}>{driverInfo.vehicle}</Text>
                        <View style={styles.ratingBadge}>
                            <Star size={12} fill="#F59E0B" color="#F59E0B" />
                            <Text style={styles.ratingText}>4.8</Text>
                        </View>
                    </View>
                    <View style={styles.driverActions}>
                        <TouchableOpacity style={styles.actionCircleButton}>
                            <Phone size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionCircleButton, { marginLeft: 12 }]}>
                            <MessageCircle size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 3. Action Section (OTP or Start Ride) */}
                {status === 'arrived' ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={handleStartRide}>
                        <Text style={styles.primaryButtonText}>Start Ride</Text>
                    </TouchableOpacity>
                ) : (
                    status !== 'completed' && status !== 'on_the_way' && (
                        <TouchableOpacity style={styles.otpBlock} activeOpacity={0.8}>
                            <View>
                                <Text style={styles.otpLabel}>START RIDE WITH OTP</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.otpCode}>{otp}</Text>
                                </View>
                            </View>
                            <View style={styles.otpIconCircle}>
                                <Copy size={18} color={colors.primary} />
                            </View>
                        </TouchableOpacity>
                    )
                )}

                {/* 4. Safety / Tools */}
                <View style={styles.footerRow}>
                    <TouchableOpacity style={styles.safetyLink}>
                        <Shield size={16} color={colors.info} />
                        <Text style={styles.safetyText}>Safety Toolkit</Text>
                    </TouchableOpacity>
                    {status === 'completed' && (
                        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
                            <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
                        </TouchableOpacity>
                    )}
                </View>

            </Animated.View>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    otpBlock: { backgroundColor: colors.primary50, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.primary100 },
    otpLabel: { fontSize: 12, color: colors.primary, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    otpCode: { fontSize: 32, fontWeight: '800', color: colors.primary, letterSpacing: 4 },
    otpIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },

    radarContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    radarCircle: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    radarCore: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
    radarPulse: { position: 'absolute', width: '100%', height: '100%', borderRadius: 100, backgroundColor: colors.primary },
    radarText: { ...typography.h3, color: colors.textPrimary, marginBottom: 10 },
    cancelButton: { position: 'absolute', bottom: 60, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center' },

    // Map
    map: { flex: 1, width: '100%' },
    mapPlaceholder: { flex: 1, backgroundColor: '#EAEEF2' },
    topOverlay: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 20, left: 20, zIndex: 10 },
    circleButton: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4
    },

    // Markers
    driverMarker: {
        // Removed container styles for simple arrow
    },

    // ...

    modalOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', zIndex: 100, elevation: 100 // High elevation
    },
    ratingModal: {
        width: width * 0.85,
        backgroundColor: colors.white,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 101
    },
    pinContainer: { alignItems: 'center', justifyContent: 'center' },
    pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.white },
    pinStem: { width: 2, height: 12, backgroundColor: colors.white, marginTop: -2 }, // primitive stem

    // Bottom Sheet
    bottomSheet: {
        position: 'absolute', bottom: 30, left: 20, right: 20,
        backgroundColor: colors.white,
        borderRadius: 24,
        padding: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
    },

    // Status Header
    statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statusIndicator: { width: 12, height: 12, justifyContent: 'center', alignItems: 'center' },
    pulsingDot: { width: 10, height: 10, borderRadius: 5 },
    statusTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
    statusSub: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },

    // Driver Card
    driverCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    driverAvatar: {
        width: 52, height: 52, borderRadius: 26, backgroundColor: colors.gray100,
        justifyContent: 'center', alignItems: 'center', marginRight: 16
    },
    driverInfo: { flex: 1 },
    driverName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    vehicleText: { fontSize: 12, color: colors.textTertiary, marginBottom: 6 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.gray50, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    ratingText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

    driverActions: { flexDirection: 'row' },
    actionCircleButton: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gray50,
        justifyContent: 'center', alignItems: 'center',
    },

    // OTP Block
    otpBlock: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#F3F4F6', borderRadius: 16, padding: 20, marginBottom: 20
    },
    otpLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
    otpCode: { fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: 2 },
    otpIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },

    // Footer
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    safetyLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    safetyText: { fontSize: 13, fontWeight: '600', color: colors.info },
});
