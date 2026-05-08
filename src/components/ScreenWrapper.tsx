import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    noPadding?: boolean;
}

export default function ScreenWrapper({ children, style, noPadding }: ScreenWrapperProps) {
    return (
        <SafeAreaView style={[styles.container, style]}>
            <View style={[styles.inner, noPadding && { padding: 0 }]}>{children}</View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    inner: {
        flex: 1,
    },
});
