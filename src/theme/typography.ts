import { TextStyle, Platform } from "react-native";
import { colors } from "./colors";

const fontFamily = Platform.select({ ios: "System", android: "Roboto" });

export const typography = {
    // Headings
    h1: {
        fontSize: 34,
        fontWeight: "800" as TextStyle["fontWeight"],
        lineHeight: 44,
        color: colors.textPrimary,
        letterSpacing: -0.5,
        fontFamily,
    },
    h2: {
        fontSize: 26,
        fontWeight: "700" as TextStyle["fontWeight"],
        lineHeight: 34,
        color: colors.textPrimary,
        letterSpacing: -0.3,
        fontFamily,
    },
    h3: {
        fontSize: 20,
        fontWeight: "600" as TextStyle["fontWeight"],
        lineHeight: 28,
        color: colors.textPrimary,
        letterSpacing: -0.2,
        fontFamily,
    },

    // Body Text
    body: {
        fontSize: 16,
        fontWeight: "400" as TextStyle["fontWeight"],
        lineHeight: 24,
        color: colors.textSecondary,
        fontFamily,
    },
    bodyBold: {
        fontSize: 16,
        fontWeight: "600" as TextStyle["fontWeight"],
        lineHeight: 24,
        color: colors.textPrimary,
        fontFamily,
    },
    small: {
        fontSize: 14,
        fontWeight: "500" as TextStyle["fontWeight"],
        lineHeight: 20,
        color: colors.textSecondary,
        fontFamily,
    },

    // Utilities
    caption: {
        fontSize: 12,
        fontWeight: "500" as TextStyle["fontWeight"],
        lineHeight: 16,
        color: colors.textTertiary,
        fontFamily,
    },
    button: {
        fontSize: 16,
        fontWeight: "600" as TextStyle["fontWeight"],
        letterSpacing: 0.3,
        fontFamily,
    }
};

// Backwards compatibility alias
export const fontStyles = typography;
