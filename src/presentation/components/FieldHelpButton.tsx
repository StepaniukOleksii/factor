import React, {useState} from "react";
import {Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {COLORS, ELEVATION, RADIUS} from "@presentation/theme";

export interface FieldHelpButtonProps {
    /** The dialog's heading — normally the label of the field this sits in. */
    title: string;
    /** The dialog's body. Line breaks are rendered as typed. */
    text: string;
    /** The button's testID; its dialog derives one by appending `-dialog`. */
    testID?: string;
}

/** The glyph is far smaller than a touch target, so the rest is slop. */
const GLYPH_SIZE = 18;
const HIT_SLOP = 11;

/**
 * An info button that opens a dialog explaining the field it sits in.
 *
 * Owns whether its dialog is open: no caller needs to read that, and only one
 * dialog can be open at a time by nature, so there is nothing to coordinate.
 *
 * A window above the form rather than text inside the field, so nothing on the
 * form reflows when it opens, and a long body needs no truncation, no clamping
 * and no "more" affordance.
 *
 * Deliberately not built on a generic modal component: there isn't one, and
 * creating one is tracked separately — this follows the styling of the
 * confirmation dialogs already on the Observation Details screen instead.
 */
export function FieldHelpButton({title, text, testID}: FieldHelpButtonProps) {
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);

    return (
        <>
            <TouchableOpacity
                testID={testID}
                onPress={() => setOpen(true)}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`About ${title}`}
            >
                <MaterialIcons name="info-outline" size={GLYPH_SIZE} color={COLORS.onSurfaceVariant}/>
            </TouchableOpacity>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={close}
            >
                <Pressable style={styles.overlay} onPress={close}>
                    <Pressable
                        testID={testID ? `${testID}-dialog` : undefined}
                        style={styles.content}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.textGroup}>
                            <Text style={styles.title}>{title}</Text>
                            {/* One Text, so the newlines the user typed survive as
                                line breaks. It scrolls rather than clips: 500
                                characters fit comfortably at the default text size,
                                but need not at the largest accessibility ones. */}
                            <ScrollView style={styles.bodyScroll}>
                                <Text style={styles.body}>{text}</Text>
                            </ScrollView>
                        </View>
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={close}
                                accessibilityLabel={`Close ${title} description`}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    content: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.xl,
        maxWidth: 384,
        width: '100%',
        // Shrinks to what the overlay leaves it, so a body long enough to
        // outgrow the screen scrolls instead of pushing the dismiss action off.
        flexShrink: 1,
        padding: 24,
        gap: 24,
        ...ELEVATION.dialog,
    },
    textGroup: {
        gap: 8,
        flexShrink: 1,
    },
    bodyScroll: {
        flexGrow: 0,
        flexShrink: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.onSurface,
        lineHeight: 28,
    },
    body: {
        fontSize: 16,
        color: COLORS.onSurfaceVariant,
        lineHeight: 24,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    closeButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: RADIUS.pill,
    },
    closeButtonText: {
        color: COLORS.onSurface,
        fontSize: 14,
        fontWeight: '500',
    },
});
