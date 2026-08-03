import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import DateTimePicker, {type DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {MaterialIcons} from '@expo/vector-icons';
import {Dialog} from '@presentation/components';
import {COLORS, RADIUS, TYPOGRAPHY} from '@presentation/theme';
import {formatShortDate} from '@shared/formatTimeRange';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';
import {floorToDay, startOfNextDay} from './chartDefaults';

export interface CustomTimeRangeModalProps {
  visible: boolean;
  initialRange: TimeRange;
  onApply: (range: TimeRange) => void;
  onCancel: () => void;
}

const END_BEFORE_START_MESSAGE = "End can't be before start";

/**
 * The last day a half-open range actually covers. `range.end` is the exclusive
 * boundary - the start of the day *after* the one the user picked - so it is
 * stepped back before being floored.
 */
function lastIncludedDay(range: TimeRange): Date {
  return floorToDay(new Date(range.end.getTime() - 1));
}

/**
 * Picks the Start and End of an arbitrary chart window, to the nearest calendar
 * day. A Start and End on the same day is a valid, one-day-wide selection.
 *
 * The picked days become the half-open `TimeRange` the rest of the app queries
 * with only on Apply, so "the day the user picked" and "the query boundary" are
 * never confused in between.
 *
 * The parent owns visibility: Apply reports the range and leaves closing to it.
 */
export function CustomTimeRangeModal({
  visible,
  initialRange,
  onApply,
  onCancel,
}: CustomTimeRangeModalProps) {
  const [startDay, setStartDay] = useState(() => floorToDay(initialRange.start));
  const [endDay, setEndDay] = useState(() => lastIncludedDay(initialRange));
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);

  // Re-synced on every open rather than on every `initialRange` change, so each
  // open reflects whatever selection is active now and a cancelled edit is never
  // carried into the next one.
  useEffect(() => {
    if (!visible) {
      return;
    }
    setStartDay(floorToDay(initialRange.start));
    setEndDay(lastIncludedDay(initialRange));
    setOpenPicker(null);
  }, [visible]);

  const endBeforeStart = endDay.getTime() < startDay.getTime();

  const handlePicked =
    (setDay: (day: Date) => void) => (event: DateTimePickerEvent, picked?: Date) => {
      setOpenPicker(null);
      if (event.type === 'set' && picked) {
        setDay(floorToDay(picked));
      }
    };

  const handleApply = () => {
    onApply({start: floorToDay(startDay), end: startOfNextDay(endDay)});
  };

  return (
    <Dialog
      visible={visible}
      title="Custom time range"
      message="Choose a start and end day."
      onRequestClose={onCancel}
      actions={[
        {
          label: 'Cancel',
          onPress: onCancel,
          accessibilityLabel: 'Cancel custom time range',
        },
        {
          label: 'Apply',
          onPress: handleApply,
          variant: 'primary',
          disabled: endBeforeStart,
          accessibilityLabel: 'Apply custom time range',
        },
      ]}
    >
      <DayField
        label="Start"
        endpoint="start"
        value={startDay}
        invalid={endBeforeStart}
        onPress={() => setOpenPicker('start')}
      />
      {openPicker === 'start' && (
        <DateTimePicker
          testID="custom-range-start-picker"
          value={startDay}
          mode="date"
          onChange={handlePicked(setStartDay)}
        />
      )}

      <DayField
        label="End"
        endpoint="end"
        value={endDay}
        invalid={endBeforeStart}
        onPress={() => setOpenPicker('end')}
      />
      {openPicker === 'end' && (
        <DateTimePicker
          testID="custom-range-end-picker"
          value={endDay}
          mode="date"
          // Today is the latest day that can hold Records; Start is left
          // unbounded, and their ordering is enforced by the Apply-time
          // validation instead - constraining one picker against the other
          // would make the selectable range shift as the user edits.
          maximumDate={floorToDay(new Date())}
          onChange={handlePicked(setEndDay)}
        />
      )}

      {endBeforeStart && <Text style={styles.error}>{END_BEFORE_START_MESSAGE}</Text>}
    </Dialog>
  );
}

interface DayFieldProps {
  label: string;
  endpoint: 'start' | 'end';
  value: Date;
  invalid: boolean;
  onPress: () => void;
}

/**
 * A labeled day, opening its picker on tap. Deliberately not a
 * `LabeledTextField` - the day is chosen, never typed.
 */
function DayField({label, endpoint, value, invalid, onPress}: DayFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        testID={`custom-range-${endpoint}-date`}
        style={[styles.fieldValue, invalid && styles.fieldValueInvalid]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatShortDate(value)}. Change.`}
      >
        <Text style={styles.fieldValueText}>{formatShortDate(value)}</Text>
        <MaterialIcons name="calendar-month" size={18} color={COLORS.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  fieldValue: {
    height: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.sm,
  },
  fieldValueInvalid: {
    borderColor: COLORS.error,
  },
  fieldValueText: {
    color: COLORS.onSurface,
    fontSize: 14,
  },
  // Pulled up against the field it refers to, out of the card's own 24pt gap.
  error: {...TYPOGRAPHY.error, marginTop: -8},
});
