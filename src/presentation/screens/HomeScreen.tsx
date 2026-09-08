import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ScreenContainer, ScreenHeader} from "@presentation/components";
import {COLORS, RADIUS} from "@presentation/theme";
import type {RootStackParamList} from '../navigation/routes';

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

const GUTTER = 16;

const GLYPH_SIZE = 40;

export function HomeScreen({navigation}: HomeScreenProps) {
    return (
        <ScreenContainer>
            <ScreenHeader title="Factor"/>

            <View style={styles.destinations}>
                <TouchableOpacity
                    style={styles.destination}
                    onPress={() => navigation.navigate('ObservationList')}
                    activeOpacity={0.8}
                >
                    <View style={styles.glyph}>
                        <MaterialIcons name="show-chart" size={24} color={COLORS.primaryContainer}/>
                    </View>
                    <Text style={styles.destinationLabel}>Observations</Text>
                    <MaterialIcons name="chevron-right" size={24} color={COLORS.outline}/>
                </TouchableOpacity>
            </View>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    destinations: {
        padding: GUTTER,
        gap: 12,
    },
    destination: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: GUTTER,
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.lg,
        padding: GUTTER,
    },
    glyph: {
        width: GLYPH_SIZE,
        height: GLYPH_SIZE,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.surfaceContainerHigh,
        justifyContent: 'center',
        alignItems: 'center',
    },
    destinationLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
    },
});
