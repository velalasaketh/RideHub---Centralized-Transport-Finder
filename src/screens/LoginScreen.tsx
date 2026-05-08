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
    Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { sendOTPEmail, generateOTP } from '../services/emailService';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft, X } from 'lucide-react-native';
import ScreenWrapper from '../components/ScreenWrapper';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [show2FA, setShow2FA] = useState(false);
    const [generatedOTP, setGeneratedOTP] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [sendingReset, setSendingReset] = useState(false);

    const { setIs2FAVerified } = useAuth();

    // Refs for OTP auto-focus
    const otpRefs = useRef<(TextInput | null)[]>([]);

    const fadeAnim = useState(new Animated.Value(0))[0];
    const slideAnim = useState(new Animated.Value(30))[0];

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing Fields', 'Please enter both email and password.');
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            const code = generateOTP();
            setGeneratedOTP(code);
            await sendOTPEmail(email, code);
            setShow2FA(true);
            // Focus first OTP cell after transition
            setTimeout(() => otpRefs.current[0]?.focus(), 500);
        } catch (error: any) {
            const msg = error.code === 'auth/wrong-password' ? 'Incorrect password.'
                : error.code === 'auth/user-not-found' ? 'No account with this email.'
                    : error.code === 'auth/invalid-credential' ? 'Invalid email or password.'
                        : 'Login failed. Please try again.';
            Alert.alert('Login Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleOTPChange = (value: string, index: number) => {
        const newDigits = [...otpDigits];
        newDigits[index] = value;
        setOtpDigits(newDigits);

        // Auto-focus next cell when a digit is entered
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOTPKeyPress = (e: any, index: number) => {
        // On backspace, move to previous cell
        if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOTP = () => {
        const otp = otpDigits.join('');
        if (otp === generatedOTP) {
            setIs2FAVerified(true);
            // Navigation is handled automatically by AppNavigator when is2FAVerified becomes true
        } else {
            Alert.alert('Wrong Code', 'The verification code you entered is incorrect.');
        }
    };

    const handleForgotPassword = async () => {
        const trimmedEmail = forgotEmail.trim();
        if (!trimmedEmail) {
            Alert.alert('Error', 'Please enter your email address.');
            return;
        }
        setSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, trimmedEmail);
            console.log('Firebase: Password reset email sent for:', trimmedEmail); // Log for debugging
            Alert.alert('Email Sent', 'A password reset link has been sent to your email.');
            setShowForgotModal(false);
            setForgotEmail('');
        } catch (error: any) {
            console.error('Firebase: Forgot Password Error:', error.code, error.message);
            const msg = error.code === 'auth/user-not-found' ? 'No user found with this email.' : 'Failed to send reset email. Make sure the email is correct.';
            Alert.alert('Error', msg);
        } finally {
            setSendingReset(false);
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
                            <Text style={styles.otpTitle}>Enter Verification Code</Text>
                            <Text style={styles.otpSubtitle}>
                                We've sent a 6-digit code to{'\n'}
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
                                        textContentType="oneTimeCode"
                                        selectTextOnFocus
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, otpDigits.join('').length < 6 && styles.buttonDisabled]}
                                onPress={handleVerifyOTP}
                                disabled={otpDigits.join('').length < 6}
                            >
                                <Text style={styles.primaryButtonText}>Verify</Text>
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
                            <Text style={styles.taglineText}>Find the smartest ride, every time</Text>
                        </View>

                        {/* Form Card */}
                        <View style={styles.formCard}>
                            <Text style={styles.formTitle}>Welcome back</Text>
                            <Text style={styles.formSubtitle}>Sign in to continue</Text>

                            {/* Email */}
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

                            {/* Password */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={styles.inputContainer}>
                                    <Lock size={18} color={colors.textTertiary} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textTertiary}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} color={colors.textTertiary} /> : <Eye size={18} color={colors.textTertiary} />}
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setForgotEmail(email); // Pre-fill with login email if present
                                        setShowForgotModal(true);
                                    }}
                                    style={{ alignSelf: 'flex-end', marginTop: 10, paddingRight: 4 }}
                                >
                                    <Text style={{ ...typography.small, color: colors.primary, fontWeight: '700' }}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.9}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.white} size="small" />
                                ) : (
                                    <>
                                        <Text style={styles.primaryButtonText}>Sign In</Text>
                                        <ArrowRight size={18} color={colors.white} style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Register Link */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Don't have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text style={styles.footerLink}> Create Account</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Forgot Password Modal */}
            <Modal
                visible={showForgotModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowForgotModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.forgotCard}>
                        <View style={styles.forgotHeader}>
                            <Text style={styles.forgotTitle}>Reset Password</Text>
                            <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                                <X size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.forgotSubtitle}>Enter your email address and we'll send you a link to reset your password.</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Email Address</Text>
                            <View style={styles.inputContainer}>
                                <Mail size={18} color={colors.textTertiary} />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="your@email.com"
                                    value={forgotEmail}
                                    onChangeText={setForgotEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, (!forgotEmail || sendingReset) && styles.buttonDisabled]}
                            onPress={handleForgotPassword}
                            disabled={!forgotEmail || sendingReset}
                        >
                            {sendingReset ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.primaryButtonText}>Send Reset Link</Text>
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
    scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
    backButton: { marginBottom: 20 },
    logoSection: { alignItems: 'center', marginBottom: 40 },
    logoCircle: {
        width: 160,
        height: 160,
        borderRadius: 50,
        backgroundColor: colors.white, // Match logo background
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
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
    taglineText: { ...typography.body, color: colors.textSecondary, marginTop: 8 },
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
    formTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    formSubtitle: { ...typography.body, color: colors.textSecondary, marginTop: 4, marginBottom: 24 },
    inputGroup: { marginBottom: 18 },
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    forgotCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    forgotHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    forgotTitle: {
        ...typography.h3,
        fontSize: 20,
        color: colors.textPrimary,
    },
    forgotSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: 24,
    },
});
