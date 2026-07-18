import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {TimeRangeSelector} from './TimeRangeSelector';
import type {TimeRangePreset, TimeRangeSelection} from './chartDefaults';
import {formatTimeRange} from '@shared/formatTimeRange';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

vi.mock('react-native', () => require('react-native-web'));

const ALL_PRESETS: TimeRangePreset[] = ['1D', '1W', '1M', '1Y'];

/** Jul 15 through Jul 18, as the half-open range the app stores it. */
const CUSTOM_RANGE: TimeRange = {start: new Date(2026, 6, 15), end: new Date(2026, 6, 19)};

function presetSelection(preset: TimeRangePreset): TimeRangeSelection {
  return {kind: 'preset', preset};
}

function customSelection(range: TimeRange = CUSTOM_RANGE): TimeRangeSelection {
  return {kind: 'custom', range};
}

interface RenderOptions {
  selected?: TimeRangeSelection;
  onSelectPreset?: (preset: TimeRangePreset) => void;
  onPressCustom?: () => void;
  disabled?: boolean;
}

function render({
  selected = presetSelection('1M'),
  onSelectPreset = vi.fn(),
  onPressCustom = vi.fn(),
  disabled = false,
}: RenderOptions = {}) {
  let root: any;
  act(() => {
    root = renderer.create(
      <TimeRangeSelector
        selected={selected}
        onSelectPreset={onSelectPreset}
        onPressCustom={onPressCustom}
        disabled={disabled}
      />,
    );
  });
  return root!;
}

/** Segment labels in render order. */
function renderedLabels(root: any): string[] {
  return root.root.findAllByType(Text).map((node: any) => node.props.children);
}

/** The outermost match is the touchable itself, carrying its press and a11y props. */
function presetSegment(root: any, preset: TimeRangePreset) {
  return root.root.findAllByProps({testID: `time-range-preset-${preset}`})[0];
}

function customSegment(root: any) {
  return root.root.findAllByProps({testID: 'time-range-custom'})[0];
}

function selectedStates(root: any): boolean[] {
  return [...ALL_PRESETS.map(preset => presetSegment(root, preset)), customSegment(root)].map(
    node => node.props.accessibilityState.selected,
  );
}

function flexOf(node: any) {
  return StyleSheet.flatten(node.props.style).flex;
}

describe('TimeRangeSelector', () => {
  it('renders one segment per preset, shortest window first, then Custom', () => {
    const root = render();

    expect(renderedLabels(root)).toEqual([...ALL_PRESETS, 'Custom']);
  });

  it('gives the Custom segment more width than a preset, so a range fits as its label', () => {
    const root = render();

    for (const preset of ALL_PRESETS) {
      expect(flexOf(customSegment(root))).toBeGreaterThan(flexOf(presetSegment(root, preset)));
    }
  });

  it.each(ALL_PRESETS)('reports %s when its segment is pressed', preset => {
    const onSelectPreset = vi.fn();
    const onPressCustom = vi.fn();
    const root = render({onSelectPreset, onPressCustom});

    act(() => {
      presetSegment(root, preset).props.onPress();
    });

    expect(onSelectPreset).toHaveBeenCalledWith(preset);
    expect(onPressCustom).not.toHaveBeenCalled();
  });

  it.each<[string, TimeRangeSelection]>([
    ['a preset is selected', presetSelection('1M')],
    ['a custom range is already applied', customSelection()],
  ])('asks for the range modal when Custom is pressed while %s', (_case, selected) => {
    const onSelectPreset = vi.fn();
    const onPressCustom = vi.fn();
    const root = render({selected, onSelectPreset, onPressCustom});

    act(() => {
      customSegment(root).props.onPress();
    });

    // Custom never selects anything itself, so pressing it again while it is
    // already active reopens the modal rather than doing nothing.
    expect(onPressCustom).toHaveBeenCalledTimes(1);
    expect(onSelectPreset).not.toHaveBeenCalled();
  });

  it('marks only the selected preset as selected', () => {
    const root = render({selected: presetSelection('1W')});

    expect(selectedStates(root)).toEqual([false, true, false, false, false]);
  });

  it('marks only Custom as selected while a custom range is applied', () => {
    const root = render({selected: customSelection()});

    expect(selectedStates(root)).toEqual([false, false, false, false, true]);
  });

  it('labels the Custom segment with the applied range instead of the word "Custom"', () => {
    const root = render({selected: customSelection()});

    expect(renderedLabels(root)).toEqual([...ALL_PRESETS, formatTimeRange(CUSTOM_RANGE)]);
  });

  it('stops showing a range as soon as the selection moves to a preset', () => {
    const root = render({selected: customSelection()});
    expect(renderedLabels(root).at(-1)).toBe(formatTimeRange(CUSTOM_RANGE));

    act(() => {
      root.update(
        <TimeRangeSelector
          selected={presetSelection('1W')}
          onSelectPreset={vi.fn()}
          onPressCustom={vi.fn()}
        />,
      );
    });

    expect(renderedLabels(root).at(-1)).toBe('Custom');
  });

  it('exposes no way to select while disabled', () => {
    const onSelectPreset = vi.fn();
    const onPressCustom = vi.fn();
    const root = render({onSelectPreset, onPressCustom, disabled: true});

    const segments = [...ALL_PRESETS.map(preset => presetSegment(root, preset)), customSegment(root)];
    for (const {props} of segments) {
      expect(props.disabled).toBe(true);
      expect(props.accessibilityState.disabled).toBe(true);
      // No handler to fire at all, so a press queued as the flag flipped cannot
      // start a second reload on top of the one already in flight.
      expect(props.onPress).toBeUndefined();
    }

    expect(onSelectPreset).not.toHaveBeenCalled();
    expect(onPressCustom).not.toHaveBeenCalled();
  });

  it('labels every segment for screen readers', () => {
    const root = render();

    expect(ALL_PRESETS.map(preset => presetSegment(root, preset).props.accessibilityLabel)).toEqual([
      'Show last day',
      'Show last week',
      'Show last month',
      'Show last year',
    ]);
    expect(customSegment(root).props.accessibilityLabel).toBe('Choose a custom time range');
  });

  it('announces the applied range, and that it can be edited, on the Custom segment', () => {
    const root = render({selected: customSelection()});

    expect(customSegment(root).props.accessibilityLabel).toBe(
      `Custom range: ${formatTimeRange(CUSTOM_RANGE)}. Edit.`,
    );
  });
});
