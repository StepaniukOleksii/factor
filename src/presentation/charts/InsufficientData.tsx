import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {COLORS} from '@presentation/theme';

export interface InsufficientDataProps {
  /** The height the chart would have taken, so the card keeps its size. */
  height: number;
}

/**
 * What a chart renderer shows in place of a drawing it has no points for. Shared
 * by every renderer, so a card looks the same whichever metric type left it
 * empty.
 */
export const InsufficientData = ({height}: InsufficientDataProps) => (
  <View style={[styles.insufficient, {height}]}>
    <Text style={styles.insufficientText}>{TREND_INSUFFICIENT_MESSAGE}</Text>
  </View>
);

const styles = StyleSheet.create({
  insufficient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
  },
});
