import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import {
    ArrowLeft,
    MapPin,
    Clock,
    Star,
    DollarSign,
    Shield,
    CheckCircle,
    Zap,
    Car,
    Banknote,
    Smartphone,
    CreditCard,
    Wallet,
    X,
    Lock,
} from 'lucide-react-native';
import { auth, db } from '../services/firebaseConfig';
import { addDoc, collection, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedPaymentMethod } from './PaymentMethodsScreen';
import { Audio } from 'expo-av';

const paymentSuccessSound = require('../assets/sounds/payment_success.mp3');

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirmation'>;

export default function BookingConfirmationScreen({ route, navigation }: Props) {
    const { ride, pickup, drop, pickupCoords, dropCoords, durationText, highestFare } = route.params;
    const [loading, setLoading] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState('Cash');
    const [walletBalance, setWalletBalance] = useState(0);
    const [showCardModal, setShowCardModal] = useState(false);
    const [showUpiModal, setShowUpiModal] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [upiPin, setUpiPin] = useState('');
    const [processingPayment, setProcessingPayment] = useState(false);
    const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
    const successScaleAnim = useState(new Animated.Value(0))[0];
    const successOpacityAnim = useState(new Animated.Value(0))[0];
    const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);

    const fadeAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(0.96))[0];
    const soundRef = React.useRef<Audio.Sound | null>(null);

    useEffect(() => {
        fetchWalletBalance();
        loadSavedMethods();
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();

        return () => {
            // Cleanup sound on unmount
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const loadSavedMethods = async () => {
        try {
            const data = await AsyncStorage.getItem('savedPaymentMethods');
            if (data) setSavedMethods(JSON.parse(data));
        } catch (error) {
            console.error('Error loading saved methods:', error);
        }
    };

    const fetchWalletBalance = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const docSnap = await getDoc(doc(db, 'users', user.uid));
            if (docSnap.exists() && docSnap.data().walletBalance !== undefined) {
                setWalletBalance(docSnap.data().walletBalance);
            }
        } catch (e) {
            console.warn('Error fetching wallet balance:', e);
        }
    };

    const createBooking = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const docRef = await addDoc(collection(db, 'bookings'), {
                userId: user.uid,
                provider: ride.provider?.name || ride.name,
                type: ride.type,
                fare: ride.fare,
                eta: ride.eta,
                rating: ride.rating,
                isSurge: ride.isSurge,
                surgeMultiplier: ride.surgeMultiplier,
                pickup: pickup || 'Current Location',
                drop: drop || 'Destination',
                pickupCoordinates: pickupCoords || null,
                dropCoordinates: dropCoords || null,
                status: 'finding_driver',
                paymentMethod: selectedPayment,
                timestamp: Date.now(),
                durationText: durationText || null,
                highestFare: highestFare || null,
                savedAmount: highestFare ? Math.max(0, highestFare - ride.fare) : 0,
            });

            navigation.replace('RideStatus', {
                rideId: docRef.id,
                initialStatus: 'finding_driver',
            });
        } catch (error) {
            Alert.alert('Booking Failed', 'Could not place your booking. Please try again.');
        }
    };

    const playSuccessSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(paymentSuccessSound);
            soundRef.current = sound;
            await sound.playAsync();
        } catch (e) {
            // Silently fail if sound can't be played
        }
    };

    const showSuccessAndNavigate = () => {
        setShowPaymentSuccess(true);
        successScaleAnim.setValue(0);
        successOpacityAnim.setValue(0);
        Animated.parallel([
            Animated.spring(successScaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }),
            Animated.timing(successOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
        // Play payment success sound
        playSuccessSound();
        setTimeout(async () => {
            await createBooking();
            setShowPaymentSuccess(false);
        }, 2200);
    };

    const processWalletPayment = async () => {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                walletBalance: increment(-ride.fare)
            });
            setLoading(false);
            showSuccessAndNavigate();
        } catch (e) {
            setLoading(false);
            Alert.alert('Payment Failed', 'Could not deduct from wallet.');
        }
    };

    const processSimulatedPayment = async (modalSetter: any) => {
        setProcessingPayment(true);
        setTimeout(() => {
            setProcessingPayment(false);
            modalSetter(false);
            showSuccessAndNavigate();
        }, 2000);
    };

    // Card number formatting: add space every 4 digits
    const handleCardNumberChange = (text: string) => {
        const raw = text.replace(/\s/g, '');
        if (raw.length > 16) return;
        const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
        setCardNumber(formatted);
    };

    // Expiry formatting: auto-insert slash after MM
    const handleExpiryChange = (text: string) => {
        let raw = text.replace(/\//g, '');
        if (raw.length > 4) return;
        if (raw.length >= 2) {
            raw = raw.substring(0, 2) + '/' + raw.substring(2);
        }
        setCardExpiry(raw);
    };

    const handleConfirm = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Error', 'Please sign in first.');
            return;
        }

        // Handle saved payment methods
        if (selectedPayment.startsWith('saved_')) {
            const methodId = selectedPayment.replace('saved_', '');
            const method = savedMethods.find(m => m.id === methodId);
            if (method?.type === 'upi') {
                setShowUpiModal(true);
            } else {
                // Saved card — already validated, process directly
                setLoading(true);
                setProcessingPayment(true);
                await new Promise(resolve => setTimeout(resolve, 2000));
                setProcessingPayment(false);
                await createBooking();
                showSuccessAndNavigate();
                setLoading(false);
            }
            return;
        }

        if (selectedPayment === 'Cash') {
            setLoading(true);
            await createBooking();
            setLoading(false);
        } else if (selectedPayment === 'Wallet') {
            if (walletBalance < ride.fare) {
                Alert.alert('Insufficient Balance', 'Please add money to your wallet or select another payment method.');
                return;
            }
            await processWalletPayment();
        } else if (selectedPayment === 'Card') {
            setShowCardModal(true);
        } else if (selectedPayment === 'UPI') {
            setShowUpiModal(true);
        }
    };

    return (
        <ScreenWrapper style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Confirm Booking</Text>
            </View>

            <Animated.ScrollView
                style={{ flex: 1, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Ride Provider Card */}
                <View style={styles.providerCard}>
                    <View style={styles.providerIcon}>
                        <Car size={28} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={styles.providerName}>{ride.name}</Text>
                        <View style={styles.ratingRow}>
                            <Star size={14} color="#F59E0B" fill="#F59E0B" />
                            <Text style={styles.ratingText}>{ride.rating}</Text>
                            {ride.isSurge && (
                                <View style={styles.surgeBadge}>
                                    <Zap size={10} color={colors.error} fill={colors.error} />
                                    <Text style={styles.surgeText}>{ride.surgeMultiplier}× Surge</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={styles.fareBox}>
                        <Text style={styles.fareLabel}>Fare</Text>
                        <Text style={styles.fareValue}>₹{ride.fare}</Text>
                    </View>
                </View>

                {/* Route Details */}
                <View style={styles.routeCard}>
                    <View style={styles.routeRow}>
                        <View style={styles.routeDot} />
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={styles.routeLabel}>Pickup</Text>
                            <Text style={styles.routeText} numberOfLines={2}>{pickup || 'Current Location'}</Text>
                        </View>
                    </View>
                    <View style={styles.routeConnector}>
                        <View style={styles.connectorLine} />
                    </View>
                    <View style={styles.routeRow}>
                        <View style={[styles.routeDot, styles.squareDot]} />
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={styles.routeLabel}>Drop-off</Text>
                            <Text style={styles.routeText} numberOfLines={2}>{drop || 'Destination'}</Text>
                        </View>
                    </View>
                </View>

                {/* Trip Info Card */}
                <View style={styles.detailsCard}>
                    <Text style={styles.cardTitle}>Trip Details</Text>
                    <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                            <Clock size={18} color={colors.primary} />
                        </View>
                        <Text style={styles.detailLabel}>Est. Arrival</Text>
                        <Text style={styles.detailValue}>{ride.eta} min</Text>
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                            <Shield size={18} color={colors.info} />
                        </View>
                        <Text style={styles.detailLabel}>Safety</Text>
                        <Text style={[styles.detailValue, { color: colors.success }]}>Ride Insurance</Text>
                    </View>
                </View>

                {/* Payment Card */}
                <View style={[styles.detailsCard, { paddingBottom: 10 }]}>
                    <View style={styles.cardHeaderRow}>
                        <DollarSign size={18} color={colors.success} style={{ marginRight: 8 }} />
                        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Payment Method</Text>
                    </View>

                    <View style={styles.paymentOptionsVertical}>
                        {[
                            { id: 'Cash', icon: Banknote, subtitle: 'Pay directly to Captain' },
                            { id: 'UPI', icon: Smartphone, subtitle: 'GPay, PhonePe, Paytm' },
                            { id: 'Card', icon: CreditCard, subtitle: 'Credit & Debit cards' },
                            { id: 'Wallet', icon: Wallet, subtitle: `RideHub balance: ₹${walletBalance.toLocaleString('en-IN')}` }
                        ].map((method) => {
                            const IconCmp = method.icon;
                            const isSelected = selectedPayment === method.id;
                            return (
                                <TouchableOpacity
                                    key={method.id}
                                    style={[
                                        styles.paymentCardRow,
                                        isSelected && styles.paymentCardRowSelected
                                    ]}
                                    onPress={() => setSelectedPayment(method.id)}
                                >
                                    <View style={[styles.paymentIconBox, isSelected && styles.paymentIconBoxSelected]}>
                                        <IconCmp size={18} color={isSelected ? colors.white : colors.textSecondary} />
                                    </View>
                                    <View style={styles.paymentTextCol}>
                                        <Text style={[styles.paymentMethodTitle, isSelected && styles.paymentMethodTitleSelected]}>
                                            {method.id}
                                        </Text>
                                        <Text style={[styles.paymentMethodSubtitle, isSelected && styles.paymentMethodSubtitleSelected]}>
                                            {method.subtitle}
                                        </Text>
                                    </View>
                                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                                        {isSelected && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            )
                        })}

                        {/* Saved Methods */}
                        {savedMethods.length > 0 && (
                            <View style={{ marginTop: 8 }}>
                                <Text style={{ ...typography.small, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>Saved Methods</Text>
                                {savedMethods.map((method) => {
                                    const isSelected = selectedPayment === `saved_${method.id}`;
                                    return (
                                        <TouchableOpacity
                                            key={method.id}
                                            style={[
                                                styles.paymentCardRow,
                                                isSelected && styles.paymentCardRowSelected
                                            ]}
                                            onPress={() => setSelectedPayment(`saved_${method.id}`)}
                                        >
                                            <View style={[styles.paymentIconBox, isSelected && styles.paymentIconBoxSelected]}>
                                                {method.type === 'upi' ? (
                                                    <Smartphone size={18} color={isSelected ? colors.white : colors.success} />
                                                ) : (
                                                    <CreditCard size={18} color={isSelected ? colors.white : colors.info} />
                                                )}
                                            </View>
                                            <View style={styles.paymentTextCol}>
                                                <Text style={[styles.paymentMethodTitle, isSelected && styles.paymentMethodTitleSelected]}>
                                                    {method.title}
                                                </Text>
                                                <Text style={[styles.paymentMethodSubtitle, isSelected && styles.paymentMethodSubtitleSelected]}>
                                                    {method.subtitle}
                                                </Text>
                                            </View>
                                            <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                                                {isSelected && <View style={styles.radioInner} />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>

                {/* Safety Note */}
                <View style={styles.safetyBanner}>
                    <CheckCircle size={16} color={colors.success} />
                    <Text style={styles.safetyText}>Your ride is covered under our safety policy.</Text>
                </View>
            </Animated.ScrollView>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <View>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalFare}>₹{ride.fare}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
                    onPress={handleConfirm}
                    disabled={loading}
                    activeOpacity={0.9}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                        <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                    )}
                </TouchableOpacity>
            </View>
            {/* Card Payment Modal */}
            <Modal visible={showCardModal} animationType="slide" transparent={true} onRequestClose={() => !processingPayment && setShowCardModal(false)}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Card Payment</Text>
                            <TouchableOpacity onPress={() => setShowCardModal(false)} disabled={processingPayment}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Saved Cards Section */}
                        {savedMethods.filter(m => m.type === 'card').length > 0 && (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ ...typography.small, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Saved Cards</Text>
                                {savedMethods.filter(m => m.type === 'card').map((card) => (
                                    <TouchableOpacity
                                        key={card.id}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center',
                                            backgroundColor: colors.gray50, padding: 14, borderRadius: 14,
                                            borderWidth: 1.5, borderColor: colors.gray100, marginBottom: 8,
                                        }}
                                        disabled={processingPayment}
                                        onPress={async () => {
                                            setProcessingPayment(true);
                                            await new Promise(resolve => setTimeout(resolve, 2000));
                                            setProcessingPayment(false);
                                            setShowCardModal(false);
                                            showSuccessAndNavigate();
                                        }}
                                    >
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.info + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                            <CreditCard size={18} color={colors.info} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...typography.bodyBold, fontSize: 14, color: colors.textPrimary }}>{card.title}</Text>
                                            <Text style={{ ...typography.small, color: colors.textSecondary }}>{card.subtitle}</Text>
                                        </View>
                                        <Text style={{ ...typography.bodyBold, color: colors.primary }}>Pay ₹{ride.fare}</Text>
                                    </TouchableOpacity>
                                ))}
                                {processingPayment && (
                                    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 4 }}>Processing payment...</Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.gray200 }} />
                                    <Text style={{ ...typography.small, color: colors.gray300, marginHorizontal: 12 }}>Or enter new card</Text>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.gray200 }} />
                                </View>
                            </View>
                        )}

                        <TextInput style={styles.modalInput} placeholder="Card Number" keyboardType="numeric" maxLength={19} value={cardNumber} onChangeText={handleCardNumberChange} editable={!processingPayment} placeholderTextColor={colors.gray400} />
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="MM/YY" keyboardType="numeric" maxLength={5} value={cardExpiry} onChangeText={handleExpiryChange} editable={!processingPayment} placeholderTextColor={colors.gray400} />
                            <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="CVV" keyboardType="numeric" maxLength={3} value={cardCvv} onChangeText={setCardCvv} editable={!processingPayment} secureTextEntry placeholderTextColor={colors.gray400} />
                        </View>
                        <TouchableOpacity
                            style={[styles.payModalButton, (processingPayment || cardNumber.replace(/\s/g, '').length < 16 || cardCvv.length < 3) && { opacity: 0.6 }]}
                            onPress={() => processSimulatedPayment(setShowCardModal)}
                            disabled={processingPayment || cardNumber.replace(/\s/g, '').length < 16 || cardCvv.length < 3}
                        >
                            {processingPayment ? <ActivityIndicator color={colors.white} /> : <Text style={styles.payModalButtonText}>Pay ₹{ride.fare}</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* UPI Payment Modal */}
            <Modal visible={showUpiModal} animationType="fade" transparent={true} onRequestClose={() => !processingPayment && setShowUpiModal(false)}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Lock size={20} color={colors.success} style={{ marginRight: 8 }} />
                                <Text style={styles.modalTitle}>UPI Payment</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowUpiModal(false)} disabled={processingPayment}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Saved UPI IDs */}
                        {savedMethods.filter(m => m.type === 'upi').length > 0 && (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ ...typography.small, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Saved UPI</Text>
                                {savedMethods.filter(m => m.type === 'upi').map((upi) => (
                                    <TouchableOpacity
                                        key={upi.id}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center',
                                            backgroundColor: colors.gray50, padding: 14, borderRadius: 14,
                                            borderWidth: 1.5, borderColor: colors.gray100, marginBottom: 8,
                                        }}
                                        disabled={processingPayment}
                                        onPress={async () => {
                                            setProcessingPayment(true);
                                            await new Promise(resolve => setTimeout(resolve, 2000));
                                            setProcessingPayment(false);
                                            setShowUpiModal(false);
                                            showSuccessAndNavigate();
                                        }}
                                    >
                                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.success + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                            <Smartphone size={18} color={colors.success} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...typography.bodyBold, fontSize: 14, color: colors.textPrimary }}>{upi.title}</Text>
                                            <Text style={{ ...typography.small, color: colors.textSecondary }}>{upi.subtitle}</Text>
                                        </View>
                                        <Text style={{ ...typography.bodyBold, color: colors.primary }}>Pay ₹{ride.fare}</Text>
                                    </TouchableOpacity>
                                ))}
                                {processingPayment && (
                                    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 4 }}>Processing payment...</Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.gray200 }} />
                                    <Text style={{ ...typography.small, color: colors.gray300, marginHorizontal: 12 }}>Or enter UPI PIN</Text>
                                    <View style={{ flex: 1, height: 1, backgroundColor: colors.gray200 }} />
                                </View>
                            </View>
                        )}

                        <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: 16 }}>Paying RideHub</Text>
                        <TextInput style={[styles.modalInput, { textAlign: 'center', fontSize: 24, letterSpacing: 8 }]} placeholder="••••••" keyboardType="numeric" maxLength={6} secureTextEntry value={upiPin} onChangeText={setUpiPin} autoFocus editable={!processingPayment} />
                        <TouchableOpacity
                            style={[styles.payModalButton, (processingPayment || upiPin.length < 4) && { opacity: 0.6 }]}
                            onPress={() => processSimulatedPayment(setShowUpiModal)}
                            disabled={processingPayment || upiPin.length < 4}
                        >
                            {processingPayment ? <ActivityIndicator color={colors.white} /> : <Text style={styles.payModalButtonText}>Submit PIN</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Payment Success Overlay */}
            <Modal visible={showPaymentSuccess} transparent animationType="fade">
                <View style={styles.successOverlay}>
                    <Animated.View style={[styles.successContent, { opacity: successOpacityAnim, transform: [{ scale: successScaleAnim }] }]}>
                        <View style={styles.successCircle}>
                            <CheckCircle size={56} color={colors.white} fill={colors.success} />
                        </View>
                        <Text style={styles.successTitle}>Payment Successful!</Text>
                        <Text style={styles.successSubtitle}>₹{ride.fare} paid via {selectedPayment}</Text>
                        <Text style={styles.successRedirect}>Finding your captain...</Text>
                    </Animated.View>
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
    headerTitle: { ...typography.h3, fontSize: 18, color: colors.textPrimary },
    scrollContent: { padding: 20, paddingBottom: 120 },
    providerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.gray100,
        marginBottom: 16,
    },
    providerIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: colors.primary50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    providerName: { ...typography.h3, fontSize: 18, color: colors.textPrimary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
    ratingText: { ...typography.small, fontWeight: '700', color: colors.textSecondary, marginRight: 8 },
    surgeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 3,
    },
    surgeText: { fontSize: 11, fontWeight: '700', color: colors.error },
    fareBox: { alignItems: 'flex-end' },
    fareLabel: { ...typography.caption, color: colors.textSecondary },
    fareValue: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    routeCard: {
        backgroundColor: colors.card,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.gray100,
        marginBottom: 16,
    },
    routeRow: { flexDirection: 'row', alignItems: 'center' },
    routeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
    squareDot: { borderRadius: 2, backgroundColor: colors.success },
    routeConnector: { paddingLeft: 6, height: 28, justifyContent: 'center' },
    connectorLine: { width: 1.5, height: '100%', backgroundColor: colors.gray200 },
    routeLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: 2 },
    routeText: { ...typography.bodyBold, color: colors.textPrimary, fontSize: 15 },
    detailsCard: {
        backgroundColor: colors.card,
        padding: 20,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.gray100,
        marginBottom: 16,
    },
    cardTitle: { ...typography.bodyBold, fontSize: 16, color: colors.textPrimary, marginBottom: 16 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    detailRow: { flexDirection: 'row', alignItems: 'center' },
    detailIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    detailLabel: { flex: 1, ...typography.body, color: colors.textSecondary },
    detailValue: { ...typography.bodyBold, color: colors.textPrimary },
    paymentOptionsVertical: {
        gap: 10,
        marginTop: 12,
        paddingBottom: 8,
    },
    paymentCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: colors.gray50,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: colors.gray100,
    },
    paymentCardRowSelected: {
        backgroundColor: colors.primary + '10', // 10% opacity
        borderColor: colors.primary,
    },
    paymentIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    paymentIconBoxSelected: {
        backgroundColor: colors.primary,
    },
    paymentTextCol: {
        flex: 1,
    },
    paymentMethodTitle: {
        ...typography.bodyBold,
        fontSize: 15,
        color: colors.textPrimary,
    },
    paymentMethodTitleSelected: {
        color: colors.primary,
    },
    paymentMethodSubtitle: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 1,
    },
    paymentMethodSubtitleSelected: {
        color: colors.primary,
        opacity: 0.8,
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.gray300,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioCircleSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    separator: { height: 1, backgroundColor: colors.gray100, marginVertical: 14 },
    safetyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        padding: 14,
        borderRadius: 14,
        gap: 10,
    },
    safetyText: { ...typography.small, color: '#065F46', fontWeight: '600', flex: 1 },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 20,
        paddingBottom: 36,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.gray100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 10,
    },
    totalLabel: { ...typography.caption, color: colors.textSecondary },
    totalFare: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    confirmButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 36,
        paddingVertical: 16,
        borderRadius: 16,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    confirmButtonDisabled: { opacity: 0.6 },
    confirmButtonText: { ...typography.button, color: colors.white, fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { ...typography.h3, fontSize: 20, color: colors.textPrimary },
    modalInput: { backgroundColor: colors.gray50, borderRadius: 14, paddingHorizontal: 16, height: 52, ...typography.body, color: colors.textPrimary, borderWidth: 1.5, borderColor: colors.gray200 },
    payModalButton: { backgroundColor: colors.primary, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    payModalButtonText: { ...typography.button, color: colors.white, fontSize: 16 },
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successContent: {
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: 40,
        borderRadius: 32,
        marginHorizontal: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
        elevation: 20,
    },
    successCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#ECFDF5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    successTitle: {
        ...typography.h2,
        fontSize: 22,
        color: colors.success,
        marginBottom: 8,
    },
    successSubtitle: {
        ...typography.body,
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 16,
    },
    successRedirect: {
        ...typography.small,
        color: colors.textTertiary,
        fontWeight: '600',
    },
});
