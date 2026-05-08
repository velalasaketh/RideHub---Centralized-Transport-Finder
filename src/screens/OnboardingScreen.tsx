import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MapPin, Car, Shield, ArrowRight } from 'lucide-react-native';
import ScreenWrapper from '../components/ScreenWrapper';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');

const slides = [
    {
        icon: Car,
        image: require('../../assets/onboarding_compare.png'),
        title: 'Compare Rides Instantly',
        description: 'See fares from CityMove, UrbanRide, and Ridezy side by side. Find the cheapest, fastest, or highest-rated ride.',
        color: colors.primary,
        bg: colors.primary50,
    },
    {
        icon: MapPin,
        image: require('../../assets/onboarding_route.png'),
        title: 'Smart Route Pricing',
        description: 'Get accurate fare estimates based on your exact route distance. No more surprises.',
        color: colors.success,
        bg: '#ECFDF5',
    },
    {
        icon: Shield,
        image: require('../../assets/onboarding_safety.png'),
        title: 'Safe & Reliable',
        description: 'Every ride is tracked and covered under our safety policy. Travel with confidence.',
        color: colors.info,
        bg: '#ECFEFF',
    },
];

export default function OnboardingScreen({ navigation }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    }, []);

    const handleNext = async () => {
        if (currentIndex < slides.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            navigation.replace('Login');
        }
    };

    const handleSkip = async () => {
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        navigation.replace('Login');
    };

    const slide = slides[currentIndex];
    const Icon = slide.icon;

    return (
        <ScreenWrapper style={styles.container}>
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                {/* Skip */}
                <View style={styles.topBar}>
                    {currentIndex < slides.length - 1 ? (
                        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                            <Text style={styles.skipText}>Skip</Text>
                        </TouchableOpacity>
                    ) : <View />}
                </View>

                {/* Illustration */}
                <View style={styles.illustrationArea}>
                    <Image source={slide.image} style={styles.onboardingImage} resizeMode="contain" />
                </View>

                {/* Text */}
                <View style={styles.textArea}>
                    <Text style={styles.title}>{slide.title}</Text>
                    <Text style={styles.description}>{slide.description}</Text>
                </View>

                {/* Dots and Button */}
                <View style={styles.bottomSection}>
                    <View style={styles.dotsRow}>
                        {slides.map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === currentIndex && styles.dotActive,
                                ]}
                            />
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.nextButton}
                        onPress={handleNext}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.nextButtonText}>
                            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
                        </Text>
                        <ArrowRight size={18} color={colors.white} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, paddingHorizontal: 32 },
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16 },
    skipButton: { paddingHorizontal: 16, paddingVertical: 8 },
    skipText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
    illustrationArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    onboardingImage: {
        width: width * 0.75,
        height: width * 0.75,
        borderRadius: 24,
    },
    textArea: { alignItems: 'center', paddingBottom: 32 },
    title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.3 },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginTop: 12,
        paddingHorizontal: 8,
    },
    bottomSection: { paddingBottom: 48 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.gray200,
    },
    dotActive: {
        width: 32,
        backgroundColor: colors.primary,
    },
    nextButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    nextButtonText: { ...typography.button, color: colors.white, fontSize: 16 },
});
