import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {COLORS, RADIUS} from '@presentation/theme';
import {TIME_RANGE_PRESETS, type TimeRangePreset} from './chartDefaults';

export interface TimeRangeSelectorProps {
  selected: TimeRangePreset;
  onSelect: (preset: TimeRangePreset) => void;
  disabled?: boolean;
}

// Declaration order of TIME_RANGE_PRESETS - shortest window first - so a preset
// added there is rendered here without touching this component.
const PRESETS = Object.keys(TIME_RANGE_PRESETS) as TimeRangePreset[];

const ACCESSIBILITY_LABELS: Record<TimeRangePreset, string> = {
  '1D': 'Show last day',
  '1W': 'Show last week',
  '1M': 'Show last month',
  '1Y': 'Show last year',
};

/**
 * The Trends section's shared window control: one segment per preset, exactly one
 * of them selected. Selecting is all this component does - the screen owns the
 * selected preset and the reload it implies, so one selection moves every chart in
 * the section to the same window rather than each chart carrying its own.
 *
 * `disabled` is set while a switch's fetch is in flight, so rapid re-tapping
 * cannot stack up overlapping reloads.
 */
export function TimeRangeSelector({selected, onSelect, disabled = false}: TimeRangeSelectorProps) {
  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {PRESETS.map(preset => {
        const isSelected = preset === selected;
        return (
          <TouchableOpacity
            key={preset}
            testID={`time-range-preset-${preset}`}
            style={[styles.segment, isSelected && styles.segmentSelected]}
            onPress={disabled ? undefined : () => onSelect(preset)}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={ACCESSIBILITY_LABELS[preset]}
            accessibilityState={{selected: isSelected, disabled}}
          >
            <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelSelected]}>
              {preset}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.lg,
  },
  segmentSelected: {
    backgroundColor: COLORS.primaryContainer,
    borderColor: COLORS.primaryContainer,
  },
  segmentLabel: {
    color: COLORS.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: COLORS.onPrimary,
  },
});
