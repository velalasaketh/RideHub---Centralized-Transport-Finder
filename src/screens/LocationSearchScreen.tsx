import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    TextInput,
    FlatList,
    ActivityIndicator,
    Keyboard,
    ScrollView,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, MapPin, Search, Home, Briefcase, Star, Clock, Navigation } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import { useRide } from '../context/RideContext';
import { auth, db } from '../services/firebaseConfig';
import { collection, query as fsQuery, where, orderBy, limit, getDocs } from 'firebase/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'LocationSearch'>;

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export default function LocationSearchScreen({ navigation, route }: Props) {
    const { type } = route.params;
    const { setPickup, setDrop, setPickupCoords, setDropCoords } = useRide();

    const inputRef = useRef<TextInput>(null);
    const [query, setQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [loading, setLoading] = useState(false);
    const [recentLocations, setRecentLocations] = useState<string[]>([]);
    const [savedPlaces, setSavedPlaces] = useState<{ home?: string; work?: string }>({});
    const [savingFor, setSavingFor] = useState<'home' | 'work' | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 400);
        fetchRecentLocations();
        loadSavedPlaces();
        return () => clearTimeout(timer);
    }, []);

    const loadSavedPlaces = async () => {
        try {
            const home = await AsyncStorage.getItem('savedPlace_home');
            const work = await AsyncStorage.getItem('savedPlace_work');
            setSavedPlaces({ home: home || undefined, work: work || undefined });
        } catch (error) {
            console.error('Error loading saved places:', error);
        }
    };

    const fetchRecentLocations = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const q = fsQuery(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(5));
            const snap = await getDocs(q);
            const locs = new Set<string>();
            snap.forEach(doc => {
                const d = doc.data();
                if (d.drop) locs.add(d.drop);
                if (d.pickup && d.pickup !== 'Current Location') locs.add(d.pickup);
            });
            setRecentLocations(Array.from(locs).slice(0, 4));
        } catch { }
    };

    const searchPlaces = async (text: string) => {
        if (!text.trim() || text.length < 2) {
            setPredictions([]);
            return;
        }

        setLoading(true);
        try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_PLACES_API_KEY}&language=en&components=country:in`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.predictions) {
                setPredictions(data.predictions);
            } else {
                setPredictions([]);
            }
        } catch (error) {
            setPredictions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleTextChange = (text: string) => {
        setQuery(text);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!text.trim()) {
            setPredictions([]);
            return;
        }
        debounceTimer.current = setTimeout(() => searchPlaces(text), 300);
    };

    const handleSelect = async (prediction: PlacePrediction) => {
        Keyboard.dismiss();
        const address = prediction.description;

        try {
            // Try Place Details API first
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${GOOGLE_PLACES_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();

            let loc = data.result?.geometry?.location;

            // Fallback: If Place Details didn't return geometry, use Geocoding API
            if (!loc) {
                // No geometry from Place Details, trying Geocoding API...
                const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_PLACES_API_KEY}`;
                const geoRes = await fetch(geocodeUrl);
                const geoData = await geoRes.json();
                if (geoData.results && geoData.results.length > 0) {
                    loc = geoData.results[0].geometry?.location;

                }
            }

            if (type === 'pickup') {
                setPickup(address);
                if (loc) {
                    setPickupCoords({ latitude: loc.lat, longitude: loc.lng });
                } else {
                    // Could not get coordinates for pickup
                }
            } else {
                setDrop(address);
                if (loc) {
                    setDropCoords({ latitude: loc.lat, longitude: loc.lng });
                } else {
                    // Could not get coordinates for drop
                }
            }
        } catch (e) {
            // Error fetching place details
            if (type === 'pickup') setPickup(address);
            else setDrop(address);
        }

        // Save to saved places if user was setting Home/Work
        if (savingFor) {
            try {
                await AsyncStorage.setItem(`savedPlace_${savingFor}`, address);
            } catch (error) {
                console.error('Error saving place:', error);
            }
            setSavingFor(null);
        }

        // Navigation - go back to Home
        navigation.navigate('Home');
    };

    return (
        <ScreenWrapper style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {type === 'pickup' ? 'Pickup Location' : 'Drop Location'}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Search Input */}
            <View style={styles.searchBar}>
                <Search size={18} color={colors.textTertiary} />
                <TextInput
                    ref={inputRef}
                    style={styles.searchInput}
                    placeholder={type === 'pickup' ? 'Search pickup location...' : 'Search drop location...'}
                    placeholderTextColor={colors.textTertiary}
                    value={query}
                    onChangeText={handleTextChange}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {query ? (
                    <TouchableOpacity onPress={() => { setQuery(''); setPredictions([]); }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Loading */}
            {loading && (
                <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}

            {/* Results */}
            {predictions.length > 0 ? (
                <FlatList
                    data={predictions}
                    keyExtractor={(item) => item.place_id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.resultsList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.resultRow}
                            onPress={() => handleSelect(item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.resultIcon}>
                                <MapPin size={16} color={colors.textSecondary} />
                            </View>
                            <View style={styles.resultTextWrap}>
                                <Text style={styles.resultMain} numberOfLines={1}>
                                    {item.structured_formatting?.main_text || item.description}
                                </Text>
                                {item.structured_formatting?.secondary_text ? (
                                    <Text style={styles.resultSecondary} numberOfLines={1}>
                                        {item.structured_formatting.secondary_text}
                                    </Text>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            ) : (
                !loading && (
                    query.length > 0 ? (
                        <View style={styles.emptyHint}>
                            <Search size={48} color={colors.gray300} strokeWidth={1} />
                            <Text style={styles.emptyHintTitle}>No results found</Text>
                            <Text style={styles.emptyHintText}>Try a different search term</Text>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.suggestionsContainer} keyboardShouldPersistTaps="handled">
                            {/* Saved Places */}
                            <Text style={styles.sectionLabel}>Saved Places</Text>
                            <TouchableOpacity style={styles.suggestionRow} onPress={() => {
                                if (savedPlaces.home) {
                                    if (type === 'pickup') { setPickup(savedPlaces.home); } else { setDrop(savedPlaces.home); }
                                    navigation.navigate('Home');
                                } else {
                                    setSavingFor('home');
                                    Alert.alert('Set Home', 'Search and select your home address. It will be saved for quick access.');
                                }
                            }}>
                                <View style={[styles.suggestionIcon, { backgroundColor: colors.primary50 }]}>
                                    <Home size={16} color={colors.primary} />
                                </View>
                                <View style={styles.suggestionTextCol}>
                                    <Text style={styles.suggestionTitle}>{savedPlaces.home ? 'Home' : '+ Add Home'}</Text>
                                    <Text style={styles.suggestionSub} numberOfLines={1}>{savedPlaces.home || 'Set your home address'}</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.suggestionRow} onPress={() => {
                                if (savedPlaces.work) {
                                    if (type === 'pickup') { setPickup(savedPlaces.work); } else { setDrop(savedPlaces.work); }
                                    navigation.navigate('Home');
                                } else {
                                    setSavingFor('work');
                                    Alert.alert('Set Work', 'Search and select your work address. It will be saved for quick access.');
                                }
                            }}>
                                <View style={[styles.suggestionIcon, { backgroundColor: '#FEF3C7' }]}>
                                    <Briefcase size={16} color={colors.warning} />
                                </View>
                                <View style={styles.suggestionTextCol}>
                                    <Text style={styles.suggestionTitle}>{savedPlaces.work ? 'Work' : '+ Add Work'}</Text>
                                    <Text style={styles.suggestionSub} numberOfLines={1}>{savedPlaces.work || 'Set your work address'}</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Recent Locations */}
                            {recentLocations.length > 0 && (
                                <>
                                    <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Recent Locations</Text>
                                    {recentLocations.map((loc, i) => (
                                        <TouchableOpacity key={`${loc}-${i}`} style={styles.suggestionRow} onPress={() => {
                                            if (type === 'pickup') { setPickup(loc); } else { setDrop(loc); }
                                            navigation.navigate('Home');
                                        }}>
                                            <View style={[styles.suggestionIcon, { backgroundColor: colors.gray50 }]}>
                                                <Clock size={16} color={colors.textSecondary} />
                                            </View>
                                            <View style={styles.suggestionTextCol}>
                                                <Text style={styles.suggestionTitle} numberOfLines={1}>{loc}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}

                            {/* Popular Nearby */}
                            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Popular Nearby</Text>
                            {[
                                { name: 'Airport', emoji: '✈️' },
                                { name: 'Railway Station', emoji: '🚆' },
                                { name: 'Bus Stand', emoji: '🚌' },
                                { name: 'Mall', emoji: '🛍️' },
                                { name: 'Hospital', emoji: '🏥' },
                            ].map(dest => (
                                <TouchableOpacity key={dest.name} style={styles.suggestionRow} onPress={() => {
                                    setQuery(dest.name);
                                    searchPlaces(dest.name);
                                }}>
                                    <View style={[styles.suggestionIcon, { backgroundColor: '#ECFDF5' }]}>
                                        <Star size={16} color={colors.success} />
                                    </View>
                                    <View style={styles.suggestionTextCol}>
                                        <Text style={styles.suggestionTitle}>{dest.emoji} {dest.name}</Text>
                                        <Text style={styles.suggestionSub}>Search nearby</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )
                )
            )}
        </ScreenWrapper>
    );
}

// Reuse styles from previous version
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'android' ? 12 : 0,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray100,
        backgroundColor: colors.card,
    },
    backButton: { padding: 4 },
    headerTitle: { ...typography.bodyBold, fontSize: 17, color: colors.textPrimary },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.gray50,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginHorizontal: 20,
        marginTop: 16,
        height: 52,
        borderWidth: 1.5,
        borderColor: colors.gray200,
        gap: 12,
    },
    searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, fontSize: 16, height: '100%' },
    loadingRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    resultsList: { paddingHorizontal: 20, paddingTop: 8 },
    resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    resultIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    resultTextWrap: { flex: 1 },
    resultMain: { ...typography.bodyBold, fontSize: 15, color: colors.textPrimary },
    resultSecondary: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    separator: { height: 1, backgroundColor: colors.gray100, marginLeft: 54 },
    emptyHint: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
    emptyHintTitle: { ...typography.h3, color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
    emptyHintText: { ...typography.body, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 40 },
    suggestionsContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
    sectionLabel: { ...typography.small, color: colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    suggestionIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    suggestionTextCol: { flex: 1 },
    suggestionTitle: { ...typography.bodyBold, fontSize: 15, color: colors.textPrimary },
    suggestionSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});


