import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {ScrollView, Text, TouchableOpacity} from 'react-native';
import {EventMarkerPopover} from './EventMarkerPopover';
import {Event} from '../../domain/Event';

// A `Modal` renders nothing under react-test-renderer, so it stands in as a
// plain view - the same stub `CustomTimeRangeModal`'s tests use.
vi.mock('react-native', () => {
  const RN = require('react-native-web');
  RN.Modal = ({children, visible}: any) =>
    visible ? <RN.View testID="modal">{children}</RN.View> : null;
  return RN;
});
vi.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

const OCCURRED = new Date('2026-03-14T09:00:00Z');

function eventNamed(name: string, description: string | null = null, minutes = 0): Event {
  return new Event(name, name, new Date(OCCURRED.getTime() + minutes * 60_000), description);
}

function render(events: Event[]) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <EventMarkerPopover events={events} anchorX={100} anchorY={200} onDismiss={vi.fn()} />,
    );
  });
  return tree!;
}

function texts(tree: renderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(node => node.props.children).flat().filter(child => typeof child === 'string');
}

describe('EventMarkerPopover', () => {
  it('opens an event closed, with its description hidden', () => {
    const tree = render([eventNamed('today', 'A long note about it.')]);

    expect(texts(tree)).toContain('today');
    expect(texts(tree)).not.toContain('A long note about it.');
  });

  it('reveals the description when the entry is tapped', () => {
    const tree = render([eventNamed('today', 'A long note about it.')]);

    act(() => tree.root.findAllByType(TouchableOpacity)[0].props.onPress());

    expect(texts(tree)).toContain('A long note about it.');
  });

  it('folds the description away again on a second tap', () => {
    const tree = render([eventNamed('today', 'A long note about it.')]);
    const entry = tree.root.findAllByType(TouchableOpacity)[0];

    act(() => entry.props.onPress());
    act(() => entry.props.onPress());

    expect(texts(tree)).not.toContain('A long note about it.');
  });

  it('offers no tap for an event carrying no description', () => {
    const tree = render([eventNamed('repeated')]);

    expect(tree.root.findAllByType(TouchableOpacity)[0].props.disabled).toBe(true);
  });

  it('renders several events in the order they occurred', () => {
    const tree = render([eventNamed('this week', null, 0), eventNamed('today', null, 60)]);

    const names = texts(tree).filter(text => text === 'this week' || text === 'today');
    expect(names).toEqual(['this week', 'today']);
  });

  it('opens one entry without opening its neighbour', () => {
    const tree = render([eventNamed('this week', 'Older note.'), eventNamed('today', 'Newer note.', 60)]);

    act(() => tree.root.findAllByType(TouchableOpacity)[1].props.onPress());

    expect(texts(tree)).toContain('Newer note.');
    expect(texts(tree)).not.toContain('Older note.');
  });

  it('caps its height and scrolls its entries past the point they fit', () => {
    const many = Array.from({length: 12}, (_, index) => eventNamed(`event ${index}`, null, index * 60));

    const tree = render(many);

    const [scroll] = tree.root.findAllByType(ScrollView);
    expect(scroll.props.style.maxHeight).toBeGreaterThan(0);
    expect(scroll.props.scrollEnabled).toBe(true);
  });
});
