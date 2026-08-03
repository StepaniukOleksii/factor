import React, {ReactNode} from "react";
import {Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {COLORS, ELEVATION, RADIUS} from "@presentation/theme";

export interface DialogAction {
    /** The button's visible text. */
    label: string;
    onPress: () => void;
    /** `plain` walks away, `primary` confirms, `destructive` destroys. */
    variant?: "plain" | "primary" | "destructive";
    /** Dims the button, blocks its press, and announces it as disabled. */
    disabled?: boolean;
    /** Replaces the label for screen readers, e.g. "Confirm record deletion". */
    accessibilityLabel?: string;
}

export interface DialogProps {
    visible: boolean;
    /** The dialog's heading. */
    title: string;
    /** Prose under the title. Line breaks are rendered as typed. */
    message?: string;
    /** Anything richer than `message` - fields, option rows - below it. */
    children?: ReactNode;
    /** Rendered right-aligned in order, so the dismissing action goes first. */
    actions: ReadonlyArray<DialogAction>;
    /** Called by the Android back button and by a press outside the card alike. */
    onRequestClose: () => void;
    /** The card's testID. */
    testID?: string;
}

/**
 * The app's centered dialog: scrim, card, title, body, and a right-aligned row
 * of actions.
 *
 * It replaced six hand-rolled copies that had drifted to three max widths, two
 * card gaps and two title sizes between them, so the values here are the
 * settled ones rather than defaults to override - a dialog wanting a different
 * width is a sign its contents, not this component, need rethinking. The width
 * is the widest of the three it found: the scrim's own padding already caps the
 * card below it on any phone narrower than ~416pt, which makes 384 mean "as
 * wide as the scrim allows" instead of a fourth arbitrary number.
 *
 * Dismissal policy belongs to the caller. `onRequestClose` covers the Android
 * back button and a press outside the card alike, so a caller that must refuse
 * one mid-operation refuses both in the one handler.
 */
export function Dialog(
    {
        visible,
        title,
        message,
        children,
        actions,
        onRequestClose,
        testID,
    }: DialogProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={onRequestClose}
        >
            <Pressable style={styles.overlay} onPress={onRequestClose}>
                {/* Not itself accessible: it exists to swallow a press, and left
                    accessible a screen reader announces the whole card as one
                    button before reaching anything inside it. */}
                <Pressable
                    testID={testID}
                    style={styles.card}
                    accessible={false}
                    onPress={event => event.stopPropagation()}
                >
                    <View style={styles.textGroup}>
                        <Text style={styles.title}>{title}</Text>
                        {/* One Text inside a scroll view, so line breaks survive
                            and a message too long for the screen scrolls rather
                            than pushing the way out of the dialog off it. */}
                        {message ? (
                            <ScrollView style={styles.messageScroll}>
                                <Text style={styles.message}>{message}</Text>
                            </ScrollView>
                        ) : null}
                    </View>

                    {children}

                    <View style={styles.actions}>
                        {actions.map((action, index) => {
                            const variant = action.variant ?? "plain";
                            return (
                                // Keyed by position: the list is fixed and never
                                // reordered, and a label can change in place (to
                                // "Deleting…") without meaning a new button.
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.action,
                                        variant === "primary" && styles.actionPrimary,
                                        variant === "destructive" && styles.actionDestructive,
                                        action.disabled && styles.actionDisabled,
                                    ]}
                                    onPress={action.onPress}
                                    disabled={action.disabled}
                                    accessibilityRole="button"
                                    accessibilityLabel={action.accessibilityLabel}
                                    accessibilityState={{disabled: action.disabled ?? false}}
                                >
                                    <Text
                                        style={[
                                            styles.actionText,
                                            variant === "primary" && styles.actionTextPrimary,
                                            variant === "destructive" && styles.actionTextDestructive,
                                        ]}
                                    >
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    card: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.xl,
        maxWidth: 384,
        width: "100%",
        // Shrinks to what the overlay leaves it, so an overlong body scrolls
        // instead of pushing the actions off the screen.
        flexShrink: 1,
        padding: 24,
        gap: 24,
        ...ELEVATION.dialog,
    },
    textGroup: {
        gap: 8,
        flexShrink: 1,
    },
    messageScroll: {
        flexGrow: 0,
        flexShrink: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: COLORS.onSurface,
        lineHeight: 28,
    },
    message: {
        fontSize: 16,
        color: COLORS.onSurfaceVariant,
        lineHeight: 24,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
    },
    action: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: RADIUS.pill,
    },
    actionPrimary: {
        backgroundColor: COLORS.primaryContainer,
    },
    actionDestructive: {
        backgroundColor: COLORS.error,
    },
    actionDisabled: {
        opacity: 0.6,
    },
    actionText: {
        color: COLORS.onSurface,
        fontSize: 14,
        fontWeight: "500",
    },
    actionTextPrimary: {
        color: COLORS.onPrimary,
    },
    actionTextDestructive: {
        color: COLORS.onError,
    },
});
