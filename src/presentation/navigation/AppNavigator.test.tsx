import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {AppNavigator} from './AppNavigator';
import {DEFAULT_TIME_RANGE_SELECTION, type TimeRangeSelection} from '../charts/chartDefaults';

// Every screen is stubbed down to the props the navigator drives it with. That
// keeps this test about navigation and the state the navigator owns, without
// dragging in SQLite, Skia or the native date picker - none of which the
// navigator itself touches.
vi.mock('../screens/ObservationListScreen', () => ({
  ObservationListScreen: 'ObservationListScreen',
}));
vi.mock('../screens/CreateObservationScreen', () => ({
  CreateObservationScreen: 'CreateObservationScreen',
}));
vi.mock('../screens/RecordFormScreen', () => ({
  RecordFormScreen: 'RecordFormScreen',
}));
vi.mock('../screens/ObservationDetailsScreen', () => ({
  ObservationDetailsScreen: 'ObservationDetailsScreen',
}));

const CUSTOM_SELECTION: TimeRangeSelection = {
  kind: 'custom',
  range: {start: new Date(2026, 6, 15), end: new Date(2026, 6, 19)},
};

const ONE_WEEK_SELECTION: TimeRangeSelection = {kind: 'preset', preset: '1W'};

function renderNavigator() {
  let root: any;
  act(() => {
    root = renderer.create(<AppNavigator />);
  });
  return root!;
}

function screen(root: any, name: string) {
  return root.root.findAllByType(name)[0];
}

function details(root: any) {
  return screen(root, 'ObservationDetailsScreen');
}

function openObservation(root: any, observationId: string) {
  act(() => {
    screen(root, 'ObservationListScreen').props.onObservationSelected(observationId);
  });
}

function chooseWindow(root: any, selection: TimeRangeSelection) {
  act(() => {
    details(root).props.onTimeRangeSelectionChange(selection);
  });
}

/** Taps a chart point, which opens that Record and unmounts the Details screen. */
function openRecord(root: any, recordId: string) {
  act(() => {
    details(root).props.onEditRecord(recordId);
  });
}

function goBackFromRecord(root: any) {
  act(() => {
    screen(root, 'RecordFormScreen').props.onBack();
  });
}

function goBackToList(root: any) {
  act(() => {
    details(root).props.onBack();
  });
}

describe('AppNavigator trend window', () => {
  it('opens an Observation on the default window', () => {
    const root = renderNavigator();

    openObservation(root, 'obs-1');

    expect(details(root).props.timeRangeSelection).toBe(DEFAULT_TIME_RANGE_SELECTION);
  });

  it('restores the chosen window after opening a Record and coming back', () => {
    const root = renderNavigator();
    openObservation(root, 'obs-1');
    chooseWindow(root, CUSTOM_SELECTION);

    openRecord(root, 'rec-1');
    // The screen is gone entirely, so nothing it held locally could survive.
    expect(root.root.findAllByType('ObservationDetailsScreen')).toHaveLength(0);
    goBackFromRecord(root);

    expect(details(root).props.timeRangeSelection).toEqual(CUSTOM_SELECTION);
  });

  it('restores a preset just as it restores a custom range', () => {
    const root = renderNavigator();
    openObservation(root, 'obs-1');
    chooseWindow(root, ONE_WEEK_SELECTION);

    openRecord(root, 'rec-1');
    goBackFromRecord(root);

    expect(details(root).props.timeRangeSelection).toEqual(ONE_WEEK_SELECTION);
  });

  it('restores the window after adding a Record too', () => {
    const root = renderNavigator();
    openObservation(root, 'obs-1');
    chooseWindow(root, CUSTOM_SELECTION);

    act(() => {
      details(root).props.onCreateRecord();
    });
    act(() => {
      screen(root, 'RecordFormScreen').props.onCreated();
    });

    expect(details(root).props.timeRangeSelection).toEqual(CUSTOM_SELECTION);
  });

  it('opens a different Observation on the default rather than inheriting a window', () => {
    const root = renderNavigator();
    openObservation(root, 'obs-1');
    chooseWindow(root, CUSTOM_SELECTION);
    goBackToList(root);

    openObservation(root, 'obs-2');

    // A range picked for one Observation's data may chart nothing for another's.
    expect(details(root).props.timeRangeSelection).toBe(DEFAULT_TIME_RANGE_SELECTION);
  });

  it('forgets the window once the user leaves for the Observation list', () => {
    const root = renderNavigator();
    openObservation(root, 'obs-1');
    chooseWindow(root, CUSTOM_SELECTION);

    goBackToList(root);
    openObservation(root, 'obs-1');

    // The same Observation, but a new exploration of it: going out to the list
    // ends the old one, so the window does not carry over into the next.
    expect(details(root).props.timeRangeSelection).toBe(DEFAULT_TIME_RANGE_SELECTION);
  });

  it('forgets the window when the Observation is deleted out from under it', () => {
    const root = renderNavigator();
    openObservation(root, 'obs-1');
    chooseWindow(root, CUSTOM_SELECTION);

    act(() => {
      details(root).props.onDeleted();
    });
    openObservation(root, 'obs-1');

    expect(details(root).props.timeRangeSelection).toBe(DEFAULT_TIME_RANGE_SELECTION);
  });
});
