import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import {
    ArrowLeft,
    Wallet,
    Plus,
    CreditCard,
    Smartphone,
    ChevronRight,
    CheckCircle,
    X,
    Trash2,
} from 'lucide-react-native';
import { auth, db } from '../services/firebaseConfig';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'savedPaymentMethods';

export interface SavedPaymentMethod {
    id: string;
    type: 'upi' | 'card';
    title: string;
    subtitle: string;
    // For UPI: full UPI ID, For Card: last 4 digits
    identifier: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentMethods'>;

export default function PaymentMethodsScreen({ navigation }: Props) {
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [addMoneyModalVisible, setAddMoneyModalVisible] = useState(false);
    const [addMethodModalVisible, setAddMethodModalVisible] = useState(false);
    const [addMethodType, setAddMethodType] = useState<'upi' | 'card'>('upi');
    const [addAmount, setAddAmount] = useState('');
    const [addingMoney, setAddingMoney] = useState(false);
    const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
    const fadeAnim = useState(new Animated.Value(0))[0];

    // Add method form states
    const [upiId, setUpiId] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [savingMethod, setSavingMethod] = useState(false);

    useEffect(() => {
        fetchWalletBalance();
        loadSavedMethods();
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    const fetchWalletBalance = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().walletBalance !== undefined) {
                setBalance(docSnap.data().walletBalance);
            } else {
                await updateDoc(docRef, { walletBalance: 0 });
                setBalance(0);
            }
        } catch (error) {
            console.warn('Error fetching balance:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSavedMethods = async () => {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                setSavedMethods(JSON.parse(data));
            }
        } catch (error) {
            console.error('Error loading saved methods:', error);
        }
    };

    const saveMethods = async (methods: SavedPaymentMethod[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(methods));
            setSavedMethods(methods);
        } catch (error) {
            console.error('Error saving methods:', error);
        }
    };

    const handleAddMoney = async () => {
        const amount = parseInt(addAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        setAddingMoney(true);
        const user = auth.currentUser;
        if (!user) return;

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await updateDoc(doc(db, 'users', user.uid), {
                walletBalance: increment(amount)
            });
            setBalance(prev => prev + amount);
            setAddMoneyModalVisible(false);
            setAddAmount('');
            Alert.alert('Success', `₹${amount} Deposited Successfully!`);
        } catch (error) {
            Alert.alert('Error', 'Failed to add money. Please try again.');
        } finally {
            setAddingMoney(false);
        }
    };

    const handleAddMethod = async () => {
        setSavingMethod(true);

        if (addMethodType === 'upi') {
            if (!upiId.includes('@')) {
                Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. name@upi)');
                setSavingMethod(false);
                return;
            }
            const newMethod: SavedPaymentMethod = {
                id: Date.now().toString(),
                type: 'upi',
                title: upiId,
                subtitle: 'UPI',
                identifier: upiId,
            };
            await saveMethods([...savedMethods, newMethod]);
        } else {
            const cleanNum = cardNumber.replace(/\s/g, '');
            if (cleanNum.length < 12) {
                Alert.alert('Invalid Card', 'Please enter a valid card number.');
                setSavingMethod(false);
                return;
            }
            if (!cardName.trim()) {
                Alert.alert('Missing Name', 'Please enter the cardholder name.');
                setSavingMethod(false);
                return;
            }
            const last4 = cleanNum.slice(-4);
            const newMethod: SavedPaymentMethod = {
                id: Date.now().toString(),
                type: 'card',
                title: `${cardName.trim()} •••• ${last4}`,
                subtitle: `Card ending in ${last4}`,
                identifier: last4,
            };
            await saveMethods([...savedMethods, newMethod]);
        }

        // Reset form
        setUpiId('');
        setCardNumber('');
        setCardName('');
        setCardExpiry('');
        setAddMethodModalVisible(false);
        setSavingMethod(false);
        Alert.alert('Success', 'Payment method saved!');
    };

    const handleRemoveMethod = (id: string, title: string) => {
        Alert.alert(
            'Remove Payment Method',
            `Are you sure you want to remove "${title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = savedMethods.filter(m => m.id !== id);
                        await saveMethods(updated);
                    },
                },
            ]
        );
    };

    const formatCardInput = (text: string) => {
        const digits = text.replace(/\D/g, '');
        const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
        setCardNumber(formatted);
    };

    const formatExpiryInput = (text: string) => {
        const digits = text.replace(/\D/g, '');
        if (digits.length >= 3) {
            setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2, 4)}`);
        } else {
            setCardExpiry(digits);
        }
    };

    const openAddMethodModal = (type: 'upi' | 'card') => {
        setAddMethodType(type);
        setUpiId('');
        setCardNumber('');
        setCardName('');
        setCardExpiry('');
        setAddMethodModalVisible(true);
    };

    return (
        <ScreenWrapper style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Methods</Text>
            </View>

            <Animated.ScrollView
                style={{ opacity: fadeAnim }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Wallet Section */}
                <Text style={styles.sectionTitle}>RideHub Wallet</Text>
                <View style={styles.walletCard}>
                    <View style={styles.walletHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.walletIconCircle}>
                                <Wallet size={24} color={colors.white} />
                            </View>
                            <View style={{ marginLeft: 16 }}>
                                <Text style={styles.walletLabel}>Available Balance</Text>
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.white} style={{ marginTop: 4, alignItems: 'flex-start' }} />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                        <Text style={styles.currencySymbol}>₹</Text>
                                        <Text style={styles.walletBalance}>{balance.toLocaleString('en-IN')}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.walletFooter}>
                        <CheckCircle size={16} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.walletSecureText}>100% Secure & Trusted</Text>

                        <TouchableOpacity
                            style={styles.addMoneyBtn}
                            onPress={() => setAddMoneyModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Plus size={16} color={colors.primary} />
                            <Text style={styles.addMoneyBtnText}>Add Money</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Saved Methods */}
                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Saved Methods</Text>

                {savedMethods.length === 0 ? (
                    <View style={styles.emptyState}>
                        <CreditCard size={40} color={colors.gray300} strokeWidth={1.5} />
                        <Text style={styles.emptyTitle}>No saved payment methods</Text>
                        <Text style={styles.emptySubtext}>Add a UPI ID or Card for faster payments</Text>
                    </View>
                ) : (
                    savedMethods.map((method) => (
                        <View key={method.id} style={styles.savedMethodCard}>
                            <View style={styles.methodIconBox}>
                                {method.type === 'upi' ? (
                                    <Smartphone size={20} color={colors.success} />
                                ) : (
                                    <CreditCard size={20} color={colors.info} />
                                )}
                            </View>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.methodTitle}>{method.title}</Text>
                                <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => handleRemoveMethod(method.id, method.title)}
                                style={styles.removeBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Trash2 size={18} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    ))
                )}

                {/* Add Method Buttons */}
                <View style={styles.addMethodRow}>
                    <TouchableOpacity
                        style={styles.addNewMethodBtn}
                        activeOpacity={0.7}
                        onPress={() => openAddMethodModal('upi')}
                    >
                        <Smartphone size={18} color={colors.primary} />
                        <Text style={styles.addNewMethodText}>Add UPI ID</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addNewMethodBtn}
                        activeOpacity={0.7}
                        onPress={() => openAddMethodModal('card')}
                    >
                        <CreditCard size={18} color={colors.primary} />
                        <Text style={styles.addNewMethodText}>Add Card</Text>
                    </TouchableOpacity>
                </View>

            </Animated.ScrollView>

            {/* Add Money Modal */}
            <Modal
                visible={addMoneyModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => !addingMoney && setAddMoneyModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Add Money to Wallet</Text>
                            <TouchableOpacity
                                onPress={() => setAddMoneyModalVisible(false)}
                                disabled={addingMoney}
                            >
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Amount (₹)</Text>
                        <View style={styles.amountInputContainer}>
                            <Text style={styles.amountPrefix}>₹</Text>
                            <TextInput
                                style={styles.amountInput}
                                value={addAmount}
                                onChangeText={setAddAmount}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={colors.gray300}
                                autoFocus
                                editable={!addingMoney}
                            />
                        </View>

                        <View style={styles.quickAmounts}>
                            {[500, 1000, 2000].map(amt => (
                                <TouchableOpacity
                                    key={amt}
                                    style={styles.quickAmtBtn}
                                    onPress={() => setAddAmount(amt.toString())}
                                    disabled={addingMoney}
                                >
                                    <Text style={styles.quickAmtText}>+₹{amt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.payButton, addingMoney && styles.payButtonDisabled, !addAmount && styles.payButtonDisabled]}
                            onPress={handleAddMoney}
                            disabled={addingMoney || !addAmount}
                            activeOpacity={0.9}
                        >
                            {addingMoney ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.payButtonText}>Proceed to Add ₹{addAmount || '0'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Add Payment Method Modal */}
            <Modal
                visible={addMethodModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => !savingMethod && setAddMethodModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>
                                {addMethodType === 'upi' ? 'Add UPI ID' : 'Add Card'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setAddMethodModalVisible(false)}
                                disabled={savingMethod}
                            >
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Method Type Tabs */}
                        <View style={styles.methodTabs}>
                            <TouchableOpacity
                                style={[styles.methodTab, addMethodType === 'upi' && styles.methodTabActive]}
                                onPress={() => setAddMethodType('upi')}
                            >
                                <Smartphone size={16} color={addMethodType === 'upi' ? colors.primary : colors.textSecondary} />
                                <Text style={[styles.methodTabText, addMethodType === 'upi' && styles.methodTabTextActive]}>UPI</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.methodTab, addMethodType === 'card' && styles.methodTabActive]}
                                onPress={() => setAddMethodType('card')}
                            >
                                <CreditCard size={16} color={addMethodType === 'card' ? colors.primary : colors.textSecondary} />
                                <Text style={[styles.methodTabText, addMethodType === 'card' && styles.methodTabTextActive]}>Card</Text>
                            </TouchableOpacity>
                        </View>

                        {addMethodType === 'upi' ? (
                            <View>
                                <Text style={styles.inputLabel}>UPI ID</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={upiId}
                                    onChangeText={setUpiId}
                                    placeholder="yourname@upi"
                                    placeholderTextColor={colors.gray300}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoFocus
                                />
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.inputLabel}>Cardholder Name</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={cardName}
                                    onChangeText={setCardName}
                                    placeholder="John Doe"
                                    placeholderTextColor={colors.gray300}
                                    autoFocus
                                />
                                <Text style={[styles.inputLabel, { marginTop: 16 }]}>Card Number</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={cardNumber}
                                    onChangeText={formatCardInput}
                                    placeholder="1234 5678 9012 3456"
                                    placeholderTextColor={colors.gray300}
                                    keyboardType="numeric"
                                    maxLength={19}
                                />
                                <Text style={[styles.inputLabel, { marginTop: 16 }]}>Expiry Date</Text>
                                <TextInput
                                    style={[styles.formInput, { width: 120 }]}
                                    value={cardExpiry}
                                    onChangeText={formatExpiryInput}
                                    placeholder="MM/YY"
                                    placeholderTextColor={colors.gray300}
                                    keyboardType="numeric"
                                    maxLength={5}
                                />
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.payButton, { marginTop: 24 }, savingMethod && styles.payButtonDisabled]}
                            onPress={handleAddMethod}
                            disabled={savingMethod}
                            activeOpacity={0.9}
                        >
                            {savingMethod ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.payButtonText}>
                                    Save {addMethodType === 'upi' ? 'UPI ID' : 'Card'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
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
        backgroundColor: colors.white,
    },
    backButton: { marginRight: 16 },
    headerTitle: { ...typography.h3, fontSize: 18, color: colors.textPrimary },
    scrollContent: { padding: 20, paddingBottom: 40 },
    sectionTitle: {
        ...typography.h3,
        fontSize: 18,
        color: colors.textPrimary,
        marginBottom: 16,
    },
    // Wallet
    walletCard: {
        backgroundColor: colors.primary,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    walletHeader: { padding: 24, paddingBottom: 20 },
    walletIconCircle: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    walletLabel: {
        ...typography.small, color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1,
    },
    currencySymbol: { fontSize: 22, fontWeight: '600', color: colors.white, marginRight: 4 },
    walletBalance: { fontSize: 36, fontWeight: '800', color: colors.white, letterSpacing: -1 },
    walletFooter: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        paddingHorizontal: 24, paddingVertical: 16,
    },
    walletSecureText: { ...typography.caption, color: 'rgba(255,255,255,0.7)', marginLeft: 6, flex: 1 },
    addMoneyBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.white,
        paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 12, gap: 6,
    },
    addMoneyBtnText: { ...typography.button, fontSize: 14, color: colors.primary },
    // Empty State
    emptyState: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 40, paddingHorizontal: 20,
        backgroundColor: colors.gray50, borderRadius: 20,
        borderWidth: 1.5, borderColor: colors.gray100,
    },
    emptyTitle: { ...typography.bodyBold, fontSize: 16, color: colors.textPrimary, marginTop: 16 },
    emptySubtext: { ...typography.small, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
    // Saved Methods
    savedMethodCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.card, padding: 20,
        borderRadius: 20, borderWidth: 1.5, borderColor: colors.gray100,
        marginBottom: 12,
    },
    methodIconBox: {
        width: 48, height: 48, borderRadius: 14,
        backgroundColor: colors.gray50,
        justifyContent: 'center', alignItems: 'center',
    },
    methodTitle: { ...typography.bodyBold, fontSize: 16, color: colors.textPrimary, marginBottom: 2 },
    methodSubtitle: { ...typography.small, color: colors.textSecondary },
    removeBtn: { padding: 8, borderRadius: 12, backgroundColor: colors.error + '10' },
    // Add Method Buttons
    addMethodRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    addNewMethodBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        padding: 18, borderRadius: 20,
        borderWidth: 1.5, borderColor: colors.gray200, borderStyle: 'dashed',
        gap: 8, backgroundColor: colors.gray50,
    },
    addNewMethodText: { ...typography.button, color: colors.textPrimary, fontSize: 14 },
    // Method Tabs
    methodTabs: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    methodTab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, borderRadius: 12, gap: 8,
        backgroundColor: colors.gray50, borderWidth: 1.5, borderColor: colors.gray100,
    },
    methodTabActive: { backgroundColor: colors.primary + '10', borderColor: colors.primary },
    methodTabText: { ...typography.bodyBold, fontSize: 14, color: colors.textSecondary },
    methodTabTextActive: { color: colors.primary },
    // Form
    formInput: {
        ...typography.body, fontSize: 16, color: colors.textPrimary,
        borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.gray50,
    },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: 24, paddingBottom: 40,
    },
    modalHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 24,
    },
    modalTitle: { ...typography.h3, fontSize: 20, color: colors.textPrimary },
    inputLabel: {
        ...typography.small, color: colors.textSecondary,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
    },
    amountInputContainer: {
        flexDirection: 'row', alignItems: 'center',
        borderBottomWidth: 2, borderBottomColor: colors.primary,
        paddingBottom: 8, marginBottom: 24,
    },
    amountPrefix: { fontSize: 32, fontWeight: '600', color: colors.textPrimary, marginRight: 8 },
    amountInput: { flex: 1, fontSize: 40, fontWeight: '800', color: colors.textPrimary, padding: 0 },
    quickAmounts: { flexDirection: 'row', gap: 12, marginBottom: 32 },
    quickAmtBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 12,
        borderWidth: 1.5, borderColor: colors.gray200, alignItems: 'center',
    },
    quickAmtText: { ...typography.bodyBold, color: colors.textPrimary },
    payButton: {
        backgroundColor: colors.primary, height: 56,
        borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    },
    payButtonDisabled: { opacity: 0.6 },
    payButtonText: { ...typography.button, color: colors.white, fontSize: 16 },
});
