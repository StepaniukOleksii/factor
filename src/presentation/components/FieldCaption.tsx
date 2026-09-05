import React from "react";
import {StyleSheet, Text} from "react-native";
import {TYPOGRAPHY} from "@presentation/theme";

export interface FieldCaptionProps {
    label: string;
    required?: boolean;
}

/**
 * The caption above a form field, carrying the mark where a save would refuse
 * what sits under it for being empty. It brings no spacing of its own, each
 * caller keeping the margins it already has.
 */
export function FieldCaption({label, required = false}: FieldCaptionProps) {
    return (
        // The announcement sits on the caption rather than on the input, whose
        // own accessibilityLabel would shadow the placeholder that Maestro
        // flows select the name fields by.
        <Text
            style={styles.caption}
            accessibilityLabel={required ? `${label}, required` : undefined}>
            {required ? `${label} *` : label}
        </Text>
    );
}

const styles = StyleSheet.create({
    caption: TYPOGRAPHY.fieldLabel,
});
