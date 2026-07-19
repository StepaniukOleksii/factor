// @vitest-environment jsdom
import React, {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {AppNavigator} from './AppNavigator';

// Every screen is stubbed down to what the navigator drives it with: the route
// params it is handed and the navigation object it moves through. That keeps
// this test about the stack, without dragging in SQLite, Skia or the native
// date picker - none of which the navigator itself touches.
//
// Each stub also holds a piece of local state, seeded once per mount. That is
// what makes "the same screen instance" observable: if a stub comes back
// carrying what was set on it, the stack preserved it rather than rebuilding.
vi.mock('react-native', () => require('react-native-web'));

// React Navigation's web views need a DOM (see the environment pragma above),
// where React expects this flag before it will treat `act` as an act scope.
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const {mounts} = vi.hoisted(() => ({mounts: {} as Record<string, number>}));

function makeScreen(name: string) {
    function Screen({route, navigation}: any) {
        const [note, setNote] = useState<string | null>(null);
        React.useEffect(() => {
            mounts[name] = (mounts[name] ?? 0) + 1;
        }, []);
        return (
            <ScreenProbe
                testID={name}
                params={route.params}
                navigation={navigation}
                note={note}
                setNote={setNote}
            />
        );
    }

    Screen.displayName = name;
    return Screen;
}

/** A host element, so its props are readable from the rendered tree. */
const ScreenProbe = 'ScreenProbe' as unknown as React.ComponentType<any>;

vi.mock('../screens/ObservationListScreen', () => ({ObservationListScreen: makeScreen('ObservationList')}));
vi.mock('../screens/CreateObservationScreen', () => ({CreateObservationScreen: makeScreen('CreateObservation')}));
vi.mock('../screens/ObservationDetailsScreen', () => ({ObservationDetailsScreen: makeScreen('ObservationDetails')}));
// One component behind both Record routes, exactly as the real navigator wires
// it, so which route a form was opened as stays part of what is under test.
vi.mock('../screens/RecordFormScreen', () => ({
    RecordFormScreen: ({route, navigation}: any) => {
        const Form = makeScreen(route.name);
        return <Form route={route} navigation={navigation}/>;
    },
}));

function renderNavigator() {
    let root: any;
    act(() => {
        root = renderer.create(<AppNavigator/>);
    });
    return root!;
}

/** Every mounted screen, topmost last - the stack as the user would read it. */
function stack(root: any): string[] {
    return root.root.findAllByType(ScreenProbe).map((probe: any) => probe.props.testID);
}

function screen(root: any, name: string) {
    const matches = root.root.findAllByType(ScreenProbe).filter((probe: any) => probe.props.testID === name);
    return matches[matches.length - 1];
}

function navigate(root: any, from: string, to: string, params?: unknown) {
    act(() => {
        screen(root, from).props.navigation.navigate(to, params);
    });
}

function goBack(root: any, from: string) {
    act(() => {
        screen(root, from).props.navigation.goBack();
    });
}

/** Writes onto the screen's own state, standing in for anything it holds. */
function leaveNote(root: any, name: string, note: string) {
    act(() => {
        screen(root, name).props.setNote(note);
    });
}

function noteOn(root: any, name: string) {
    return screen(root, name).props.note;
}

describe('AppNavigator', () => {
    beforeEach(() => {
        for (const key of Object.keys(mounts)) {
            delete mounts[key];
        }
    });

    it('starts on the Observation list', () => {
        const root = renderNavigator();

        expect(stack(root)).toEqual(['ObservationList']);
    });

    it('pushes an Observation onto the list rather than replacing it', () => {
        const root = renderNavigator();

        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});

        expect(stack(root)).toEqual(['ObservationList', 'ObservationDetails']);
        expect(screen(root, 'ObservationDetails').props.params).toEqual({observationId: 'obs-1'});
    });

    it('opens Record creation from the list', () => {
        const root = renderNavigator();

        navigate(root, 'ObservationList', 'CreateRecord', {observationId: 'obs-1'});

        expect(stack(root)).toEqual(['ObservationList', 'CreateRecord']);
    });

    it('opens Observation creation from the list, and pops back off it', () => {
        const root = renderNavigator();

        navigate(root, 'ObservationList', 'CreateObservation');
        expect(stack(root)).toEqual(['ObservationList', 'CreateObservation']);

        goBack(root, 'CreateObservation');

        expect(stack(root)).toEqual(['ObservationList']);
    });

    // The property the whole slice rests on, and the direct regression test for
    // the bug that prompted it.
    it('returns to the same Observation screen instance after a Record is opened on top of it', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});
        leaveNote(root, 'ObservationDetails', 'a chosen window');

        navigate(root, 'ObservationDetails', 'EditRecord', {observationId: 'obs-1', recordId: 'rec-1'});
        goBack(root, 'EditRecord');

        expect(stack(root)).toEqual(['ObservationList', 'ObservationDetails']);
        expect(noteOn(root, 'ObservationDetails')).toBe('a chosen window');
        // Not a fresh screen that happens to look the same.
        expect(mounts.ObservationDetails).toBe(1);
    });

    it('keeps the Observation screen mounted underneath while a Record sits on top', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});

        navigate(root, 'ObservationDetails', 'CreateRecord', {observationId: 'obs-1'});

        expect(stack(root)).toEqual(['ObservationList', 'ObservationDetails', 'CreateRecord']);
    });

    it('returns a cancelled Record form to the screen it was opened from', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});
        navigate(root, 'ObservationDetails', 'CreateRecord', {observationId: 'obs-1'});

        goBack(root, 'CreateRecord');

        // Not the list, which is where the old navigator always landed.
        expect(stack(root)).toEqual(['ObservationList', 'ObservationDetails']);
    });

    it('lands a Record saved from the list on that Observation, with the form off the stack', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'CreateRecord', {observationId: 'obs-1'});

        act(() => {
            screen(root, 'CreateRecord').props.navigation.popTo('ObservationDetails', {observationId: 'obs-1'});
        });

        expect(stack(root)).toEqual(['ObservationList', 'ObservationDetails']);
        expect(screen(root, 'ObservationDetails').props.params).toEqual({observationId: 'obs-1'});

        // Pressing back from there reaches the list, never the submitted form.
        goBack(root, 'ObservationDetails');
        expect(stack(root)).toEqual(['ObservationList']);
    });

    it('pops a Record saved from an Observation back onto that same screen', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});
        leaveNote(root, 'ObservationDetails', 'a chosen window');
        navigate(root, 'ObservationDetails', 'CreateRecord', {observationId: 'obs-1'});

        act(() => {
            screen(root, 'CreateRecord').props.navigation.popTo('ObservationDetails', {observationId: 'obs-1'});
        });

        expect(stack(root)).toEqual(['ObservationList', 'ObservationDetails']);
        expect(noteOn(root, 'ObservationDetails')).toBe('a chosen window');
        expect(mounts.ObservationDetails).toBe(1);
    });

    it('returns to the list root when an Observation is deleted, leaving nothing to go back to', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});

        act(() => {
            screen(root, 'ObservationDetails').props.navigation.popToTop();
        });

        expect(stack(root)).toEqual(['ObservationList']);
    });
});

/**
 * The exploration scoping that `AppNavigator` used to enforce with a rule, now
 * a consequence of the stack's own lifetime. Expressed against screen-local
 * state, which is where the trend window lives again.
 */
describe('AppNavigator trend window lifetime', () => {
    beforeEach(() => {
        for (const key of Object.keys(mounts)) {
            delete mounts[key];
        }
    });

    it('survives a push and pop through a Record screen', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});
        leaveNote(root, 'ObservationDetails', 'custom range');

        navigate(root, 'ObservationDetails', 'EditRecord', {observationId: 'obs-1', recordId: 'rec-1'});
        goBack(root, 'EditRecord');

        expect(noteOn(root, 'ObservationDetails')).toBe('custom range');
    });

    it('is gone after popping out to the list, even reopening the same Observation', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});
        leaveNote(root, 'ObservationDetails', 'custom range');

        goBack(root, 'ObservationDetails');
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});

        // The same Observation, but a new visit to it: the old screen was
        // destroyed on the way out, so nothing carried over.
        expect(noteOn(root, 'ObservationDetails')).toBeNull();
        expect(mounts.ObservationDetails).toBe(2);
    });

    it('is gone after the Observation is deleted and reopened', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});
        leaveNote(root, 'ObservationDetails', 'custom range');

        act(() => {
            screen(root, 'ObservationDetails').props.navigation.popToTop();
        });
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});

        expect(noteOn(root, 'ObservationDetails')).toBeNull();
    });

    it('does not carry over to a different Observation', () => {
        const root = renderNavigator();
        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-1'});
        leaveNote(root, 'ObservationDetails', 'custom range');
        goBack(root, 'ObservationDetails');

        navigate(root, 'ObservationList', 'ObservationDetails', {observationId: 'obs-2'});

        // A range picked for one Observation's data may chart nothing for another's.
        expect(noteOn(root, 'ObservationDetails')).toBeNull();
        expect(screen(root, 'ObservationDetails').props.params).toEqual({observationId: 'obs-2'});
    });
});
