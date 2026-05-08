import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { CheckCircle2, Star, User } from 'lucide-react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import ScreenWrapper from '../components/ScreenWrapper';

type Props = NativeStackScreenProps<RootStackParamList, 'RideCompleted'>;

export default function RideCompletedScreen({ route, navigation }: Props) {
    const { rideId } = route.params;
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [fare, setFare] = useState<number | null>(null);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        const fetchRideInfo = async () => {
            try {
                const docRef = doc(db, 'bookings', rideId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFare(data.fare || null);
                }
            } catch (error) {
                // Silently fail
            } finally {
                setLoading(false);
            }
        };
        fetchRideInfo();
    }, [rideId]);

    const submitRating = async () => {
        if (rating === 0) {
            handleSkip();
            return;
        }

        setSubmitting(true);
        try {
            await updateDoc(doc(db, 'bookings', rideId), {
                rating: rating,
                feedback: feedback,
                status: 'rating_submitted'
            });
            navigation.replace('Home');
        } catch (e) {
            // Silently fail
            setSubmitting(false);
        }
    };

    const handleSkip = () => {
        navigation.replace('Home');
    };

    if (loading) {
        return (
            <ScreenWrapper style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Success Header */}
                    <View style={styles.header}>
                        <CheckCircle2 size={80} color={colors.success} style={styles.successIcon} />
                        <Text style={styles.title}>Ride Completed!</Text>
                        <Text style={styles.subtitle}>We hope you enjoyed your journey.</Text>

                        {fare && (
                            <View style={styles.fareContainer}>
                                <Text style={styles.fareLabel}>Total Paid</Text>
                                <Text style={styles.fareValue}>₹{fare}</Text>
                            </View>
                        )}
                    </View>

                    {/* Driver Profile */}
                    <View style={styles.driverCard}>
                        <View style={styles.driverAvatar}>
                            <User size={30} color={colors.primary} />
                        </View>
                        <Text style={styles.driverName}>Captain Rajesh</Text>
                        <Text style={styles.driverVehicle}>Swift Dzire • KA 05 MV 2341</Text>
                    </View>

                    {/* Rating Section */}
                    <View style={styles.ratingSection}>
                        <Text style={styles.ratingPrompt}>How was your ride?</Text>
                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                                    <Star
                                        size={40}
                                        color={star <= rating ? "#F59E0B" : colors.gray200}
                                        fill={star <= rating ? "#F59E0B" : "none"}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.ratingFlavorText}>
                            {rating === 0 ? "Tap to rate" :
                                rating <= 2 ? "Could be better" :
                                    rating === 3 ? "Okay" :
                                        rating === 4 ? "Good" : "Excellent!"}
                        </Text>
                    </View>

                    {/* Feedback Input */}
                    <View style={styles.feedbackSection}>
                        <TextInput
                            style={styles.feedbackInput}
                            placeholder="Leave a comment (optional)"
                            placeholderTextColor={colors.textTertiary}
                            value={feedback}
                            onChangeText={setFeedback}
                            multiline
                            maxLength={200}
                        />
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionSection}>
                        <TouchableOpacity
                            style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                            onPress={submitRating}
                            disabled={submitting || rating === 0}
                            activeOpacity={0.8}
                        >
                            {submitting ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit Rating</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.skipButton}
                            onPress={handleSkip}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.skipButtonText}>Skip for now</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        backgroundColor: colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 32,
    },
    successIcon: {
        marginBottom: 16,
    },
    title: {
        ...typography.h2,
        color: colors.textPrimary,
        marginBottom: 8,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    fareContainer: {
        marginTop: 24,
        padding: 16,
        backgroundColor: colors.gray50,
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 160,
    },
    fareLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    fareValue: {
        ...typography.h1,
        color: colors.primary,
    },
    driverCard: {
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 32,
    },
    driverAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    driverName: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    driverVehicle: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    ratingSection: {
        alignItems: 'center',
        width: '100%',
        marginBottom: 24,
    },
    ratingPrompt: {
        ...typography.subtitle,
        color: colors.textPrimary,
        marginBottom: 16,
    },
    starsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    ratingFlavorText: {
        ...typography.caption,
        color: colors.textSecondary,
        height: 20, // Keeps height fixed so layout doesn't jump
    },
    feedbackSection: {
        width: '100%',
        marginBottom: 32,
    },
    feedbackInput: {
        backgroundColor: colors.gray50,
        borderRadius: 16,
        padding: 16,
        paddingTop: 16,
        height: 100,
        textAlignVertical: 'top',
        ...typography.body,
        color: colors.textPrimary,
    },
    actionSection: {
        width: '100%',
        marginTop: 16,
        paddingBottom: 24,
    },
    submitButton: {
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonDisabled: {
        backgroundColor: colors.gray300,
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: '700',
    },
    skipButton: {
        paddingVertical: 14,
        alignItems: 'center',
        width: '100%',
    },
    skipButtonText: {
        ...typography.body,
        color: colors.textTertiary,
        fontWeight: '600',
    }
});
