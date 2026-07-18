import React, {useEffect, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import DateTimePicker, {type DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {MaterialIcons} from '@expo/vector-icons';
import {COLORS, ELEVATION, RADIUS, TYPOGRAPHY} from '@presentation/theme';
import {formatShortDate} from '@shared/formatTimeRange';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

export interface CustomTimeRangeModalProps {
  visible: boolean;
  initialRange: TimeRange;
  onApply: (range: TimeRange) => void;
  onCancel: () => void;
}

const END_BEFORE_START_MESSAGE = "End can't be before start";

/**
 * The calendar day `date` falls on, as local midnight. Every value the pickers
 * report goes through here, so day-only precision is guaranteed by this
 * component regardless of what a given platform's native picker returns.
 */
function floorToDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local midnight of the day after `date`'s - the exclusive end of that day. */
function startOfNextDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/**
 * The last day a half-open range actually covers. `range.end` is the exclusive
 * boundary - the start of the day *after* the one the user picked - so it is
 * stepped back before being floored.
 */
function lastIncludedDay(range: TimeRange): Date {
  return floorToDay(new Date(range.end.getTime() - 1));
}

/**
 * Picks the Start and End of an arbitrary chart window, each to the nearest
 * calendar day.
 *
 * Days are the smallest unit on offer: there is no time-of-day control, and a
 * Start and End on the same day is a valid, one-day-wide selection. The two days
 * are converted into the half-open `TimeRange` the rest of the app queries with
 * only on Apply, so "the day the user picked" and "the query boundary" never get
 * confused with one another in between.
 *
 * The parent owns visibility: Apply reports the new range and leaves closing to
 * the parent, matching how the screen's other modals work.
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.content} onPress={event => event.stopPropagation()}>
          <View style={styles.textGroup}>
            <Text style={styles.title}>Custom time range</Text>
            <Text style={styles.body}>Choose a start and end day.</Text>
          </View>

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

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel custom time range"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, endBeforeStart && styles.applyButtonDisabled]}
              onPress={handleApply}
              disabled={endBeforeStart}
              accessibilityRole="button"
              accessibilityLabel="Apply custom time range"
              accessibilityState={{disabled: endBeforeStart}}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    maxWidth: 340,
    width: '100%',
    padding: 24,
    gap: 24,
    ...ELEVATION.dialog,
  },
  textGroup: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.onSurface,
    lineHeight: 28,
  },
  body: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    lineHeight: 20,
  },
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  cancelButtonText: {
    color: COLORS.onSurface,
    fontSize: 14,
    fontWeight: '500',
  },
  applyButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryContainer,
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  applyButtonText: {
    color: COLORS.onPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
});
