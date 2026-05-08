import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { sendOTPEmail, generateOTP } from '../services/emailService';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User, Phone, ChevronLeft } from 'lucide-react-native';
import ScreenWrapper from '../components/ScreenWrapper';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [show2FA, setShow2FA] = useState(false);
    const [generatedOTP, setGeneratedOTP] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [pendingUser, setPendingUser] = useState<any>(null);

    const { setIs2FAVerified } = useAuth();
    const otpRefs = useRef<(TextInput | null)[]>([]);

    const fadeAnim = useState(new Animated.Value(0))[0];
    const slideAnim = useState(new Animated.Value(30))[0];

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleRegister = async () => {
        if (!name || !email || !password) {
            Alert.alert('Missing Fields', 'Please fill in all required fields.');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Weak Password', 'Password must be at least 6 characters.');
            return;
        }
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            setPendingUser(userCredential.user);

            const code = generateOTP();
            setGeneratedOTP(code);
            await sendOTPEmail(email, code);
            setShow2FA(true);
            setTimeout(() => otpRefs.current[0]?.focus(), 500);
        } catch (error: any) {
            const msg = error.code === 'auth/email-already-in-use' ? 'This email is already registered.'
                : error.code === 'auth/invalid-email' ? 'Please enter a valid email address.'
                    : 'Registration failed. Please try again.';
            Alert.alert('Registration Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleOTPChange = (value: string, index: number) => {
        const newDigits = [...otpDigits];
        newDigits[index] = value;
        setOtpDigits(newDigits);

        // Auto-focus next cell
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOTPKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOTP = async () => {
        const otp = otpDigits.join('');
        if (otp !== generatedOTP) {
            Alert.alert('Wrong Code', 'The verification code is incorrect.');
            return;
        }
        try {
            if (pendingUser) {
                await setDoc(doc(db, 'users', pendingUser.uid), {
                    name,
                    email,
                    phone,
                    createdAt: Date.now(),
                });
            }
            setIs2FAVerified(true);
            // Navigation is handled automatically by AppNavigator
        } catch (error) {
            Alert.alert('Error', 'Could not save profile. Please try again.');
        }
    };

    if (show2FA) {
        return (
            <ScreenWrapper style={styles.container}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <TouchableOpacity onPress={() => setShow2FA(false)} style={styles.backButton}>
                            <ChevronLeft size={24} color={colors.textPrimary} />
                        </TouchableOpacity>

                        <Animated.View style={[styles.otpSection, { opacity: fadeAnim }]}>
                            <View style={styles.iconCircle}>
                                <Mail size={32} color={colors.primary} />
                            </View>
                            <Text style={styles.otpTitle}>Verify Email</Text>
                            <Text style={styles.otpSubtitle}>
                                Enter the 6-digit code sent to{'\n'}
                                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{email}</Text>
                            </Text>

                            <View style={styles.otpRow}>
                                {otpDigits.map((digit, i) => (
                                    <TextInput
                                        key={i}
                                        ref={(ref) => { otpRefs.current[i] = ref; }}
                                        style={[styles.otpCell, digit && styles.otpCellFilled]}
                                        value={digit}
                                        onChangeText={(v) => handleOTPChange(v, i)}
                                        onKeyPress={(e) => handleOTPKeyPress(e, i)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        selectTextOnFocus
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, otpDigits.join('').length < 6 && styles.buttonDisabled]}
                                onPress={handleVerifyOTP}
                                disabled={otpDigits.join('').length < 6}
                            >
                                <Text style={styles.primaryButtonText}>Verify & Continue</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                        {/* Logo */}
                        <View style={styles.logoSection}>
                            <View style={styles.logoCircle}>
                                <Image
                                    source={require('../../assets/ridehub.png')}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={styles.taglineText}>Join RideHub and ride smarter</Text>
                        </View>

                        {/* Form Card */}
                        <View style={styles.formCard}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Full Name</Text>
                                <View style={styles.inputContainer}>
                                    <User size={18} color={colors.textTertiary} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="John Doe"
                                        placeholderTextColor={colors.textTertiary}
                                        value={name}
                                        onChangeText={setName}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Email</Text>
                                <View style={styles.inputContainer}>
                                    <Mail size={18} color={colors.textTertiary} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="you@example.com"
                                        placeholderTextColor={colors.textTertiary}
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Phone (Optional)</Text>
                                <View style={styles.inputContainer}>
                                    <Phone size={18} color={colors.textTertiary} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="+91 98765 43210"
                                        placeholderTextColor={colors.textTertiary}
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={styles.inputContainer}>
                                    <Lock size={18} color={colors.textTertiary} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Min. 6 characters"
                                        placeholderTextColor={colors.textTertiary}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} color={colors.textTertiary} /> : <Eye size={18} color={colors.textTertiary} />}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleRegister}
                                disabled={loading}
                                activeOpacity={0.9}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.white} size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.primaryButtonText}>Create Account</Text>
                                        <ArrowRight size={18} color={colors.white} style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Text style={styles.footerLink}> Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
    backButton: { marginBottom: 20 },
    logoSection: { alignItems: 'center', marginBottom: 32 },
    logoCircle: {
        width: 160,
        height: 160,
        borderRadius: 50,
        backgroundColor: colors.white, // Match logo background
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    logoImage: {
        width: 120,
        height: 120,
    },
    logoText: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
    taglineText: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
    formCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1.5,
        borderColor: colors.gray100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
        elevation: 8,
    },
    inputGroup: { marginBottom: 16 },
    inputLabel: { ...typography.small, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.gray50,
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 52,
        borderWidth: 1.5,
        borderColor: colors.gray200,
        gap: 12,
    },
    textInput: { flex: 1, ...typography.body, color: colors.textPrimary, height: '100%' },
    primaryButton: {
        backgroundColor: colors.primary,
        width: '100%',
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    buttonDisabled: { opacity: 0.5 },
    primaryButtonText: { ...typography.button, color: colors.white, fontSize: 16 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
    footerText: { ...typography.body, color: colors.textSecondary },
    footerLink: { ...typography.bodyBold, color: colors.primary },
    otpSection: {
        alignItems: 'center',
        paddingTop: 40,
        width: '100%',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    otpTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    otpSubtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    otpRow: { flexDirection: 'row', gap: 10, marginTop: 32, marginBottom: 32 },
    otpCell: {
        width: 48,
        height: 56,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: colors.gray200,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
        backgroundColor: colors.gray50,
    },
    otpCellFilled: { borderColor: colors.primary, backgroundColor: colors.primary50 },
});
