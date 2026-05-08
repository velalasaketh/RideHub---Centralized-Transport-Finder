import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import ScreenWrapper from '../components/ScreenWrapper';
import { ArrowLeft, Shield, Lock, Eye, Bell, Trash2, ChevronRight } from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacySecurity'>;

export default function PrivacySecurityScreen({ navigation }: Props) {
    const [biometricEnabled, setBiometricEnabled] = React.useState(true);
    const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(true);

    const SecurityItem = ({ icon: Icon, title, subtitle, onPress, isSwitch, value, onValueChange }: any) => (
        <TouchableOpacity
            style={styles.item}
            onPress={onPress}
            disabled={isSwitch}
        >
            <View style={styles.iconContainer}>
                <Icon size={20} color={colors.primary} />
            </View>
            <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.itemSubtitle}>{subtitle}</Text>
            </View>
            {isSwitch ? (
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    trackColor={{ false: colors.gray200, true: colors.primary }}
                    thumbColor="#fff"
                />
            ) : (
                <ChevronRight size={20} color={colors.gray300} />
            )}
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy & Security</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Security Settings</Text>
                    <SecurityItem
                        icon={Lock}
                        title="Change Password"
                        subtitle="Update your account password"
                        onPress={() => { }}
                    />
                    <SecurityItem
                        icon={Shield}
                        title="Two-Factor Authentication"
                        subtitle="Add an extra layer of security"
                        isSwitch
                        value={twoFactorEnabled}
                        onValueChange={setTwoFactorEnabled}
                    />
                    <SecurityItem
                        icon={Shield}
                        title="Biometric Login"
                        subtitle="Use Fingerprint or Face ID"
                        isSwitch
                        value={biometricEnabled}
                        onValueChange={setBiometricEnabled}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Privacy</Text>
                    <SecurityItem
                        icon={Eye}
                        title="Privacy Policy"
                        subtitle="View our data usage policies"
                        onPress={() => { }}
                    />
                    <SecurityItem
                        icon={Bell}
                        title="Data Sharing"
                        subtitle="Manage how your data is shared"
                        onPress={() => { }}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Account Action</Text>
                    <TouchableOpacity style={styles.deleteButton}>
                        <Trash2 size={20} color={colors.error} />
                        <Text style={styles.deleteButtonText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
    content: { padding: 20 },
    section: { marginBottom: 32 },
    sectionLabel: {
        ...typography.small,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: '700',
        marginBottom: 16
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray50,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primary50,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    itemContent: { flex: 1 },
    itemTitle: { ...typography.bodyBold, color: colors.textPrimary },
    itemSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        backgroundColor: '#FEF2F2',
        borderRadius: 16,
        gap: 10,
        marginTop: 8,
    },
    deleteButtonText: { ...typography.bodyBold, color: colors.error },
});
