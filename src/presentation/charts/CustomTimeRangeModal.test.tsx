import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Modal, Pressable, Text} from 'react-native';
import {CustomTimeRangeModal, type CustomTimeRangeModalProps} from './CustomTimeRangeModal';
import {formatShortDate} from '@shared/formatTimeRange';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

vi.mock('react-native', () => {
  const RN = require('react-native-web');
  RN.Modal = ({children, visible}: any) =>
    visible ? <RN.View testID="modal">{children}</RN.View> : null;
  return RN;
});
vi.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));
vi.mock('@react-native-community/datetimepicker', () => ({
  default: 'DateTimePicker',
}));

type Endpoint = 'start' | 'end';

const JUL_15 = new Date(2026, 6, 15);
const JUL_16 = new Date(2026, 6, 16);
const JUL_17 = new Date(2026, 6, 17);
const JUL_18 = new Date(2026, 6, 18);
const JUL_19 = new Date(2026, 6, 19);

/** Jul 15 through Jul 18, as the half-open range the app stores it. */
const JUL_15_THROUGH_18: TimeRange = {start: JUL_15, end: JUL_19};

const END_BEFORE_START_MESSAGE = "End can't be before start";

function renderModal(overrides: Partial<CustomTimeRangeModalProps> = {}) {
  const onApply = vi.fn();
  const onCancel = vi.fn();
  const baseProps: CustomTimeRangeModalProps = {
    visible: true,
    initialRange: JUL_15_THROUGH_18,
    onApply,
    onCancel,
    ...overrides,
  };

  let root: any;
  act(() => {
    root = renderer.create(<CustomTimeRangeModal {...baseProps} />);
  });

  /** Re-renders with changed props, the way the parent would. */
  const update = (next: Partial<CustomTimeRangeModalProps>) => {
    act(() => {
      root.update(<CustomTimeRangeModal {...baseProps} {...next} />);
    });
  };

  return {root: root!, onApply, onCancel, update};
}

/** The outermost match is the touchable itself, carrying its press props. */
function field(root: any, endpoint: Endpoint) {
  return root.root.findAllByProps({testID: `custom-range-${endpoint}-date`})[0];
}

function fieldValue(root: any, endpoint: Endpoint): string {
  return field(root, endpoint).findAllByType(Text)[0].props.children;
}

function openPicker(root: any, endpoint: Endpoint) {
  act(() => {
    field(root, endpoint).props.onPress();
  });
  return root.root.findAllByProps({testID: `custom-range-${endpoint}-picker`})[0];
}

function pickDay(root: any, endpoint: Endpoint, day: Date) {
  const picker = openPicker(root, endpoint);
  act(() => {
    picker.props.onChange({type: 'set'}, day);
  });
}

function button(root: any, label: 'Apply' | 'Cancel') {
  return root.root.findAllByProps({accessibilityLabel: `${label} custom time range`})[0];
}

function press(node: any) {
  act(() => {
    node.props.onPress();
  });
}

function messages(root: any, text: string) {
  return root.root.findAll(
    (node: any) => node.children?.length === 1 && node.children[0] === text,
  );
}

describe('CustomTimeRangeModal', () => {
  it('pre-fills both fields from the range it was opened with', () => {
    const {root} = renderModal();

    expect(fieldValue(root, 'start')).toBe(formatShortDate(JUL_15));
    // Jul 19 00:00 is the exclusive boundary, so Jul 18 is the day picked.
    expect(fieldValue(root, 'end')).toBe(formatShortDate(JUL_18));
  });

  it.each<Endpoint>(['start', 'end'])(
    'floors a %s reported with a time of day to its calendar day',
    endpoint => {
      const {root} = renderModal();

      pickDay(root, endpoint, new Date(2026, 6, 17, 13, 45, 30, 500));

      expect(fieldValue(root, endpoint)).toBe(formatShortDate(JUL_17));
    },
  );

  it.each<Endpoint>(['start', 'end'])('leaves the %s alone when its picker is dismissed', endpoint => {
    const {root} = renderModal();
    const before = fieldValue(root, endpoint);

    const picker = openPicker(root, endpoint);
    act(() => {
      picker.props.onChange({type: 'dismissed'}, undefined);
    });

    expect(fieldValue(root, endpoint)).toBe(before);
  });

  it('offers no day later than today for the End', () => {
    const {root} = renderModal();
    const today = new Date();

    expect(openPicker(root, 'end').props.maximumDate).toEqual(
      new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    );
  });

  // Constraining the pickers against each other would make the selectable range
  // shift as the user edits; ordering is judged on Apply instead.
  it('leaves the Start unbounded in both directions', () => {
    const {root} = renderModal();
    const picker = openPicker(root, 'start');

    expect(picker.props.minimumDate).toBeUndefined();
    expect(picker.props.maximumDate).toBeUndefined();
  });

  it('blocks Apply and says why while End is before Start', () => {
    const {root} = renderModal();

    pickDay(root, 'start', JUL_19);

    expect(button(root, 'Apply').props.disabled).toBe(true);
    expect(messages(root, END_BEFORE_START_MESSAGE).length).toBeGreaterThan(0);
  });

  it('re-enables Apply once End is no longer before Start', () => {
    const {root} = renderModal();
    pickDay(root, 'start', JUL_19);

    pickDay(root, 'start', JUL_15);

    expect(button(root, 'Apply').props.disabled).toBe(false);
    expect(messages(root, END_BEFORE_START_MESSAGE).length).toBe(0);
  });

  it('accepts the same day at both ends as the smallest window there is', () => {
    const {root, onApply} = renderModal();

    pickDay(root, 'start', JUL_18);

    expect(button(root, 'Apply').props.disabled).toBe(false);
    expect(messages(root, END_BEFORE_START_MESSAGE).length).toBe(0);

    press(button(root, 'Apply'));

    // One whole day, not a zero-width instant.
    expect(onApply).toHaveBeenCalledWith({start: JUL_18, end: JUL_19});
  });

  it('applies a half-open range that covers the whole End day', () => {
    const {root, onApply} = renderModal();

    press(button(root, 'Apply'));

    expect(onApply).toHaveBeenCalledWith({start: JUL_15, end: JUL_19});
  });

  // Calendar arithmetic, not a fixed 24h step: on a daylight-saving day a fixed
  // step lands at 01:00 or 23:00, which would make the applied range read as a
  // day the user never picked.
  it('ends the applied range at local midnight', () => {
    const {root, onApply} = renderModal();

    press(button(root, 'Apply'));

    const {end} = onApply.mock.calls[0][0];
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it('reports a Cancel press without applying anything', () => {
    const {root, onApply, onCancel} = renderModal();
    pickDay(root, 'start', JUL_16);

    press(button(root, 'Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('cancels on a backdrop press and on a back gesture', () => {
    const {root, onCancel, onApply} = renderModal();

    press(root.root.findAllByType(Pressable)[0]);
    act(() => {
      root.root.findAllByType(Modal)[0].props.onRequestClose();
    });

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('re-syncs to the range it is reopened with, discarding a cancelled edit', () => {
    const {root, update} = renderModal();
    pickDay(root, 'start', JUL_16);
    press(button(root, 'Cancel'));
    update({visible: false});

    // The parent's selection moved on while the modal was closed.
    const june: TimeRange = {start: new Date(2026, 5, 1), end: new Date(2026, 5, 11)};
    update({visible: true, initialRange: june});

    expect(fieldValue(root, 'start')).toBe(formatShortDate(new Date(2026, 5, 1)));
    expect(fieldValue(root, 'end')).toBe(formatShortDate(new Date(2026, 5, 10)));
  });

  it('renders nothing while closed', () => {
    const {root} = renderModal({visible: false});

    expect(root.root.findAllByProps({testID: 'custom-range-start-date'})).toHaveLength(0);
  });
});
