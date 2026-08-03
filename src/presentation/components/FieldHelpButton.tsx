import React, {useState} from "react";
import {TouchableOpacity} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {COLORS} from "@presentation/theme";
import {Dialog} from "./Dialog";

export interface FieldHelpButtonProps {
    /** The dialog's heading - normally the label of the field this sits in. */
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
 * An info button that opens a dialog explaining the field it sits in. Owns its
 * own open state - no caller needs to read it.
 *
 * A dialog rather than inline text, so nothing on the form reflows and a long
 * body needs no truncation or "more" affordance.
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

            <Dialog
                visible={open}
                title={title}
                message={text}
                onRequestClose={close}
                testID={testID ? `${testID}-dialog` : undefined}
                actions={[{
                    label: "Close",
                    onPress: close,
                    accessibilityLabel: `Close ${title} description`,
                }]}
            />
        </>
    );
}
