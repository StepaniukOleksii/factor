import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';
import {TimeRangeSelector} from './TimeRangeSelector';
import type {TimeRangePreset} from './chartDefaults';

vi.mock('react-native', () => require('react-native-web'));

const ALL_PRESETS: TimeRangePreset[] = ['1D', '1W', '1M', '1Y'];

function render(
  selected: TimeRangePreset = '1M',
  onSelect = vi.fn(),
  disabled = false,
) {
  let root: any;
  act(() => {
    root = renderer.create(
      <TimeRangeSelector selected={selected} onSelect={onSelect} disabled={disabled}/>,
    );
  });
  return root!;
}

/** Segment labels in render order. */
function renderedPresets(root: any): string[] {
  return root.root.findAllByType(Text).map((node: any) => node.props.children);
}

/** The outermost match is the touchable itself, carrying its press and a11y props. */
function segment(root: any, preset: TimeRangePreset) {
  return root.root.findAllByProps({testID: `time-range-preset-${preset}`})[0];
}

describe('TimeRangeSelector', () => {
  it('renders one segment per preset, shortest window first', () => {
    const root = render();

    expect(renderedPresets(root)).toEqual(ALL_PRESETS);
  });

  it.each(ALL_PRESETS)('reports %s when its segment is pressed', preset => {
    const onSelect = vi.fn();
    const root = render('1M', onSelect);

    act(() => {
      segment(root, preset).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(preset);
  });

  it('marks only the selected segment as selected', () => {
    const root = render('1W');

    const selectedStates = ALL_PRESETS.map(
      preset => segment(root, preset).props.accessibilityState.selected,
    );

    expect(selectedStates).toEqual([false, true, false, false]);
  });

  it('exposes no way to select while disabled', () => {
    const onSelect = vi.fn();
    const root = render('1M', onSelect, true);

    for (const preset of ALL_PRESETS) {
      const {disabled, onPress, accessibilityState} = segment(root, preset).props;
      expect(disabled).toBe(true);
      expect(accessibilityState.disabled).toBe(true);
      // No handler to fire at all, so a press queued as the flag flipped cannot
      // start a second reload on top of the one already in flight.
      expect(onPress).toBeUndefined();
    }

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('labels every segment for screen readers', () => {
    const root = render();

    expect(ALL_PRESETS.map(preset => segment(root, preset).props.accessibilityLabel)).toEqual([
      'Show last day',
      'Show last week',
      'Show last month',
      'Show last year',
    ]);
  });
});
