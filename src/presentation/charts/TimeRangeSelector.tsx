import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {COLORS, RADIUS} from '@presentation/theme';
import {formatTimeRange} from '@shared/formatTimeRange';
import {TIME_RANGE_PRESETS, type TimeRangePreset, type TimeRangeSelection} from './chartDefaults';

export interface TimeRangeSelectorProps {
  selected: TimeRangeSelection;
  onSelectPreset: (preset: TimeRangePreset) => void;
  onPressCustom: () => void;
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

const CUSTOM_LABEL = 'Custom';

/**
 * The Trends section's shared window control: one segment per preset plus a
 * wider Custom segment, exactly one of them selected. Selecting is all this
 * component does - the screen owns the selection and the reload it implies, so
 * one selection moves every chart in the section to the same window rather than
 * each chart carrying its own.
 *
 * The Custom segment never selects anything itself; it asks the screen to open
 * the range modal, whether or not a custom range is already applied, so tapping
 * it again adjusts the current range. While one is applied the segment shows it
 * instead of the word "Custom", and reverts as soon as a preset is picked.
 *
 * `disabled` is set while a switch's fetch is in flight, so rapid re-tapping
 * cannot stack up overlapping reloads.
 */
export function TimeRangeSelector({
  selected,
  onSelectPreset,
  onPressCustom,
  disabled = false,
}: TimeRangeSelectorProps) {
  const customRange = selected.kind === 'custom' ? selected.range : null;
  const customSelected = customRange !== null;
  const customLabel = customRange ? formatTimeRange(customRange) : CUSTOM_LABEL;

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {PRESETS.map(preset => {
        const isSelected = selected.kind === 'preset' && selected.preset === preset;
        return (
          <TouchableOpacity
            key={preset}
            testID={`time-range-preset-${preset}`}
            style={[styles.segment, isSelected && styles.segmentSelected]}
            onPress={disabled ? undefined : () => onSelectPreset(preset)}
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
      <TouchableOpacity
        testID="time-range-custom"
        style={[styles.segment, styles.customSegment, customSelected && styles.segmentSelected]}
        onPress={disabled ? undefined : onPressCustom}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={
          customSelected ? `Custom range: ${customLabel}. Edit.` : 'Choose a custom time range'
        }
        accessibilityState={{selected: customSelected, disabled}}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.segmentLabel,
            styles.customSegmentLabel,
            customSelected && styles.customSegmentLabelRange,
            customSelected && styles.segmentLabelSelected,
          ]}
        >
          {customLabel}
        </Text>
      </TouchableOpacity>
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
  // Roughly double a preset segment's width, so an applied range fits as a label.
  customSegment: {
    flex: 2,
    paddingHorizontal: 4,
  },
  customSegmentLabel: {
    textAlign: 'center',
  },
  // A date range is a much longer label than "Custom" or a preset's two
  // characters, and has to stay on one line within the segment's width.
  customSegmentLabelRange: {
    fontSize: 11,
  },
});
