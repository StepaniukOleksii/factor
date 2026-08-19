import React from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {ObservationDetailsScreen} from './ObservationDetailsScreen';
import {Observation} from '../../domain/Observation';
import {Record as DomainRecord} from '../../domain/Record';
import {Circle, type SkFont, Text as SkiaText, useFont} from '@shopify/react-native-skia';
import {type TimeRangePreset, TREND_INSUFFICIENT_MESSAGE,} from '../charts/chartDefaults';
import {rendererRegistry} from '../charts/rendererRegistry';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';
import {formatShortDate, formatTimeRange} from '@shared/formatTimeRange';
import {COLORS, withAlpha} from '@presentation/theme';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Every fixture Observation carries one: the screen's metadata line reads it. */
const CREATED_AT = new Date(2026, 4, 18);

const defaultObservation = {
    id: 'obs-1',
    name: 'Test Observation',
    createdAt: CREATED_AT,
    metrics: [{id: 'm1', name: 'Metric 1', type: 'numeric'}],
} as unknown as Observation;

const {
    mockGetObservationByIdExecute,
    mockGetRecentRecordsExecute,
    mockGetRecordsByTimeRangeExecute,
    mockCountRecordsExecute,
    mockDeleteRecordExecute,
} = vi.hoisted(() => {
    return {
        mockGetObservationByIdExecute: vi.fn(),
        mockGetRecentRecordsExecute: vi.fn(),
        mockGetRecordsByTimeRangeExecute: vi.fn(),
        // The one use case every describe leans on without setting up: the
        // metadata line is on the screen whatever else a test is about.
        mockCountRecordsExecute: vi.fn().mockResolvedValue(0),
        mockDeleteRecordExecute: vi.fn(),
    };
});

/** The screen's `hardwareBackPress` listeners, latest registration last. */
const {backPressListeners} = vi.hoisted(() => ({
    backPressListeners: new Set<() => boolean>(),
}));

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    RN.Modal = ({children, visible}: any) =>
        visible ? <RN.View testID="modal">{children}</RN.View> : null;
    // `react-native-web`'s own logs an error and never fires, so the screen's
    // listener would be unreachable.
    RN.BackHandler = {
        addEventListener: (_event: string, handler: () => boolean) => {
            backPressListeners.add(handler);
            return {remove: () => backPressListeners.delete(handler)};
        },
    };
    return RN;
});
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));
vi.mock('@react-native-community/datetimepicker', () => ({
    default: 'DateTimePicker',
}));

const {focusListeners, blurListeners} = vi.hoisted(() => ({
    focusListeners: new Set<() => void>(),
    blurListeners: new Set<() => void>(),
}));

// `useFocusEffect` is the only React Navigation API the screen itself uses, so
// stubbing it is all that stands between this test and a NavigationContainer.
// Keyed on the callback exactly as the real hook is - so a changed time range
// re-runs it - plus a counter `refocusScreen` below bumps, standing in for the
// screen being returned to, and a flag `blurScreen` clears, for one covered by a
// screen pushed on top.
vi.mock('@react-navigation/native', () => {
    const React = require('react');
    return {
        useFocusEffect: (callback: React.EffectCallback) => {
            const [focusCount, setFocusCount] = React.useState(0);
            const [focused, setFocused] = React.useState(true);
            React.useEffect(() => {
                const onFocus = () => {
                    setFocused(true);
                    setFocusCount((count: number) => count + 1);
                };
                const onBlur = () => setFocused(false);
                focusListeners.add(onFocus);
                blurListeners.add(onBlur);
                return () => {
                    focusListeners.delete(onFocus);
                    blurListeners.delete(onBlur);
                };
            }, []);
            React.useEffect(() => (focused ? callback() : undefined), [callback, focusCount, focused]);
        },
    };
});

vi.mock('../../infrastructure/SQLiteObservationRepository', () => ({
    SQLiteObservationRepository: vi.fn(),
}));
vi.mock('../../infrastructure/SQLiteRecordRepository', () => ({
    SQLiteRecordRepository: vi.fn(),
}));

vi.mock('../../application/GetObservationByIdUseCase', () => ({
    GetObservationByIdUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetObservationByIdExecute,
    })),
}));

vi.mock('../../application/GetRecentRecordsUseCase', () => ({
    GetRecentRecordsUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetRecentRecordsExecute,
    })),
}));

vi.mock('../../application/GetRecordsByTimeRangeUseCase', () => ({
    GetRecordsByTimeRangeUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetRecordsByTimeRangeExecute,
    })),
}));

vi.mock('../../application/CountRecordsUseCase', () => ({
    CountRecordsUseCase: vi.fn().mockImplementation(() => ({
        execute: mockCountRecordsExecute,
    })),
}));

vi.mock('../../application/DeleteObservationUseCase', () => ({
    DeleteObservationUseCase: vi.fn().mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('../../application/DeleteRecordUseCase', () => ({
    DeleteRecordUseCase: vi.fn().mockImplementation(() => ({
        execute: mockDeleteRecordExecute,
    })),
}));

const initialRecord = {
    id: 'rec-1',
    observationId: 'obs-1',
    timestamp: new Date('2026-07-04T12:00:00Z'),
    values: new Map([['m1', 10]]),
} as unknown as DomainRecord;

function findAllByText(root: any, text: string) {
    return root.findAll(
        (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
    );
}

function findRecordHeader(root: any) {
    const touchables = root.findAllByProps({activeOpacity: 0.7});
    return touchables.find((t: any) => t.props.onLongPress);
}

function countRecordCards(root: any) {
    return root.findAllByProps({name: 'schedule'}).length;
}

function findTouchableWithText(root: any, text: string) {
    const textNodes = findAllByText(root, text);
    for (const textNode of textNodes) {
        let current = textNode.parent;
        while (current) {
            if (current.props && typeof current.props.onPress === 'function') {
                return current;
            }
            current = current.parent;
        }
    }
    return null;
}

/**
 * The screen owns its time range, so no harness holds one for it. It takes its
 * Observation from the route and pushes routes to move, so both are faked here;
 * `navigate` is the spy every outbound move is asserted through.
 */
async function renderScreen(navigate: (name: string, params: unknown) => void = vi.fn()) {
    let root: any;
    await act(async () => {
        root = renderer.create(
            <ObservationDetailsScreen
                route={{name: 'ObservationDetails', params: {observationId: 'obs-1'}} as any}
                navigation={{navigate, goBack: vi.fn(), popToTop: vi.fn()} as any}
            />,
        );
    });
    return root!;
}

/** Re-runs the screen's focus effects, the way returning to it does. */
async function refocusScreen() {
    await act(async () => {
        focusListeners.forEach(listener => listener());
    });
}

/** Tears the screen's focus effects down, the way a screen pushed over it does. */
async function blurScreen() {
    await act(async () => {
        blurListeners.forEach(listener => listener());
    });
}

/**
 * Android's system back button, answered by the last listener registered - the
 * real dispatch order. Returns `true` for a press the screen consumed, `false`
 * for one it declined and left React Navigation to close the screen with.
 */
async function pressSystemBack(): Promise<boolean> {
    const listener = [...backPressListeners].pop();
    // Asserted rather than answered with `false`: an unregistered listener would
    // look exactly like a declined press.
    expect(listener).toBeTruthy();
    let consumed = false;
    await act(async () => {
        consumed = listener!();
    });
    return consumed;
}

async function openRecordMenu(root: any) {
    const recordHeader = findRecordHeader(root.root);
    expect(recordHeader).toBeTruthy();
    await act(async () => {
        recordHeader.props.onLongPress();
    });
    return recordHeader;
}

async function openDeleteRecordConfirmation(root: any) {
    const deleteRecordButton = findTouchableWithText(root.root, 'Delete Record');
    await act(async () => {
        deleteRecordButton!.props.onPress();
    });
}

function numericObservation(...metrics: {id: string; name: string}[]): Observation {
    return {
        id: 'obs-1',
        name: 'Sleep Quality',
        createdAt: CREATED_AT,
        metrics: metrics.map(m => ({...m, type: 'Numeric'})),
    } as unknown as Observation;
}

/**
 * An Observation whose Metrics are declared in the order given, each with its own
 * value type - the order the Trends section is expected to render its cards in.
 */
function observationOf(...metrics: {id: string; name: string; type: string; constraint?: unknown}[]): Observation {
    return {
        id: 'obs-1',
        name: 'Sleep Quality',
        createdAt: CREATED_AT,
        metrics,
    } as unknown as Observation;
}

function enumMetric(id: string, name: string, allowedValues: string[]) {
    return {id, name, type: 'Enum', constraint: {allowedValues}};
}

function recordAgo(id: string, msAgo: number, values: [string, unknown][]): DomainRecord {
    return new DomainRecord(id, 'obs-1', new Date(Date.now() - msAgo), new Map(values));
}

function chartRecord(id: string, daysAgo: number, values: [string, unknown][]): DomainRecord {
    return recordAgo(id, daysAgo * DAY_MS, values);
}

function chartRecordHoursAgo(id: string, hoursAgo: number, values: [string, number][]): DomainRecord {
    return recordAgo(id, hoursAgo * HOUR_MS, values);
}

/** A local date-time in 2026, month written the way a person says it. */
function on(month: number, day: number, hour = 12, minute = 0): Date {
    return new Date(2026, month - 1, day, hour, minute);
}

/**
 * A Record at a given instant. One value throughout unless a test says
 * otherwise, so the series is flat and every point sits on the chart's
 * mid-line - keeping a tap's vertical hit-test independent of the width the
 * test renderer never measures.
 */
function recordAt(id: string, at: Date, values: [string, unknown][] = [['m1', 5]]): DomainRecord {
    return new DomainRecord(id, 'obs-1', at, new Map(values));
}

/**
 * Taps the leftmost point of a chart. An unmeasured chart collapses every
 * point onto the plotting rectangle's left edge, 32px in, and a tap has to
 * fall within tolerance of a point on both axes to reach it; 50 is where a
 * flat series sits within the 108px chart's plot.
 */
async function pressChartPoint(root: any, chartIndex = 0) {
    const pressable = root.root.findAllByProps({testID: 'numeric-trend-chart-pressable'})[chartIndex];
    await act(async () => {
        pressable.props.onPress({nativeEvent: {locationX: 32, locationY: 50}});
    });
}

/**
 * Taps the earliest column of a swimlane card. An unmeasured chart collapses
 * every column onto the plotting rectangle's left edge, 32px in, where the
 * earliest of them answers for the rest; the vertical coordinate is not
 * hit-tested at all, a column running the height of the plot.
 */
async function pressSwimlaneColumn(root: any, chartIndex = 0) {
    const pressable = root.root.findAllByProps({testID: 'category-swimlane-chart-pressable'})[chartIndex];
    await act(async () => {
        pressable.props.onPress({nativeEvent: {locationX: 32, locationY: 50}});
    });
}

const NUMERIC_CARD_HEIGHT = rendererRegistry.get('Numeric')!.cardHeight;
const TEXT_CARD_HEIGHT = rendererRegistry.get('Text')!.cardHeight;

function heightsOf(root: any, testID: string): number[] {
    return root.root
        .findAllByProps({testID})
        .map((box: any) => StyleSheet.flatten(box.props.style).height);
}

function chartBoxHeights(root: any): number[] {
    return heightsOf(root, 'trend-chart');
}

function rendererHeights(root: any): number[] {
    return root.root
        .findAll((node: any) => node.props?.metric && node.props?.points)
        .map((node: any) => node.props.height);
}

/**
 * The Metrics the section handed to a renderer, in the order their cards were
 * rendered - read off the renderer elements themselves, since which renderer
 * drew which card is exactly what is being asserted.
 */
function chartedMetricNames(root: any): string[] {
    return root.root
        .findAll((node: any) => node.props?.metric && node.props?.points)
        .map((node: any) => node.props.metric.name);
}

/**
 * The line-coloured marker dots the charts draw, one per aggregated point. Since
 * any point count from one upwards draws a chart, these are what say how a
 * window's Records were bucketed.
 */
function recordDots(root: any) {
    return root.root
        .findAllByType(Circle)
        .filter((circle: any) => circle.props.color === COLORS.primaryContainer);
}

/** The outermost match is the touchable itself, carrying its press and a11y props. */
function presetSegment(root: any, preset: TimeRangePreset) {
    return root.root.findAllByProps({testID: `time-range-preset-${preset}`})[0];
}

function customSegment(root: any) {
    return root.root.findAllByProps({testID: 'time-range-custom'})[0];
}

async function selectPreset(root: any, preset: TimeRangePreset) {
    await act(async () => {
        presetSegment(root, preset).props.onPress();
    });
}

function lastRequestedRange(): TimeRange {
    const calls = mockGetRecordsByTimeRangeExecute.mock.calls;
    return calls[calls.length - 1][1] as TimeRange;
}

/** Local midnight of the day `date` falls on. */
function dayOf(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local midnight `daysAgo` days back - a day the range modal can be set to. */
function dayAt(daysAgo: number): Date {
    return dayOf(new Date(Date.now() - daysAgo * DAY_MS));
}

/** Local midnight of the day after `day` - the exclusive end of that day. */
function endOfDay(day: Date): Date {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
}

async function openCustomModal(root: any) {
    await act(async () => {
        customSegment(root).props.onPress();
    });
}

function customRangeField(root: any, endpoint: 'start' | 'end') {
    return root.root.findAllByProps({testID: `custom-range-${endpoint}-date`})[0];
}

function customRangeFieldValue(root: any, endpoint: 'start' | 'end'): string {
    return customRangeField(root, endpoint).findAllByType(Text)[0].props.children;
}

async function pickCustomDay(root: any, endpoint: 'start' | 'end', day: Date) {
    await act(async () => {
        customRangeField(root, endpoint).props.onPress();
    });
    await act(async () => {
        root.root
            .findAllByProps({testID: `custom-range-${endpoint}-picker`})[0]
            .props.onChange({type: 'set'}, day);
    });
}

async function pressCustomModalButton(root: any, label: 'Apply' | 'Cancel') {
    await act(async () => {
        root.root
            .findAllByProps({accessibilityLabel: `${label} custom time range`})[0]
            .props.onPress();
    });
}

/** Opens the modal, moves Start back `daysAgo` days, and applies. */
async function applyCustomRange(root: any, daysAgo: number) {
    await openCustomModal(root);
    await pickCustomDay(root, 'start', dayAt(daysAgo));
    await pressCustomModalButton(root, 'Apply');
}

describe('ObservationDetailsScreen Record Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(defaultObservation);
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        mockDeleteRecordExecute.mockResolvedValue(undefined);
        vi.stubGlobal('alert', vi.fn());
    });

    it('opens the contextual menu on long press', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        const titles = findAllByText(root.root, 'Record actions');
        expect(titles.length).toBeGreaterThan(0);

        const editButtons = findAllByText(root.root, 'Edit Record');
        expect(editButtons.length).toBeGreaterThan(0);

        const deleteButtons = findAllByText(root.root, 'Delete Record');
        expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('dismisses the contextual menu when Cancel is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        const cancelButton = findTouchableWithText(root.root, 'Cancel');
        expect(cancelButton).toBeTruthy();

        await act(async () => {
            cancelButton!.props.onPress();
        });

        const titles = findAllByText(root.root, 'Record actions');
        expect(titles.length).toBe(0);
    });

    it('navigates to edit and closes the contextual menu when Edit Record is pressed', async () => {
        const navigate = vi.fn();
        const root = await renderScreen(navigate);
        await openRecordMenu(root);

        const editButton = findTouchableWithText(root.root, 'Edit Record');
        expect(editButton).toBeTruthy();

        await act(async () => {
            editButton!.props.onPress();
        });

        expect(navigate).toHaveBeenCalledWith('EditRecord', {observationId: 'obs-1', recordId: 'rec-1'});

        const titles = findAllByText(root.root, 'Record actions');
        expect(titles.length).toBe(0);
    });

    it('opens delete confirmation modal when Delete Record is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        const deleteRecordButton = findTouchableWithText(root.root, 'Delete Record');
        expect(deleteRecordButton).toBeTruthy();

        await act(async () => {
            deleteRecordButton!.props.onPress();
        });

        const menuTitles = findAllByText(root.root, 'Record actions');
        expect(menuTitles.length).toBe(0);

        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBeGreaterThan(0);

        const confirmBody = findAllByText(root.root, 'This specific entry will be permanently removed.');
        expect(confirmBody.length).toBeGreaterThan(0);
    });

    it('dismisses the delete confirmation modal when Cancel is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        const cancelButton = findTouchableWithText(root.root, 'Cancel');
        expect(cancelButton).toBeTruthy();

        await act(async () => {
            cancelButton!.props.onPress();
        });

        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBe(0);
        expect(mockDeleteRecordExecute).not.toHaveBeenCalled();
    });

    it('deletes the record, closes the confirmation modal, and refreshes the record list', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        // Queued after the initial load so it is only returned by the post-delete refresh
        const olderRecord = {
            id: 'rec-2',
            observationId: 'obs-1',
            timestamp: new Date('2026-07-01T09:00:00Z'),
            values: new Map([['m1', 5]]),
        } as unknown as DomainRecord;
        mockGetRecentRecordsExecute.mockResolvedValueOnce([olderRecord]);

        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        expect(deleteConfirmButton).toBeTruthy();

        await act(async () => {
            await deleteConfirmButton!.props.onPress();
        });

        expect(mockDeleteRecordExecute).toHaveBeenCalledWith('rec-1');

        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBe(0);

        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(2);
        expect(countRecordCards(root.root)).toBe(1);
    });

    it('redraws the charts without the deleted record', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        // Two days apart, so each buckets to a dot of its own at the default window.
        const charted = [chartRecord('a', 3, [['m1', 5]]), chartRecord('b', 1, [['m1', 7]])];
        mockGetRecentRecordsExecute.mockResolvedValue(charted);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue(charted);

        const root = await renderScreen();
        expect(recordDots(root).length).toBe(2);

        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        // Queued after the initial load so both queries only report it to the
        // post-delete refresh
        const remaining = [charted[1]];
        mockGetRecentRecordsExecute.mockResolvedValueOnce(remaining);
        mockGetRecordsByTimeRangeExecute.mockResolvedValueOnce(remaining);

        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        await act(async () => {
            await deleteConfirmButton!.props.onPress();
        });

        expect(mockDeleteRecordExecute).toHaveBeenCalledWith('a');
        expect(recordDots(root).length).toBe(1);
    });

    it('displays the empty state after deleting the final record', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        // Queued after the initial load so the refresh reports no remaining records
        mockGetRecentRecordsExecute.mockResolvedValueOnce([]);

        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        await act(async () => {
            await deleteConfirmButton!.props.onPress();
        });

        expect(countRecordCards(root.root)).toBe(0);
        const emptyState = findAllByText(root.root, 'No records yet.');
        expect(emptyState.length).toBeGreaterThan(0);
    });

    it('keeps the record and shows an error message when deletion fails', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        mockDeleteRecordExecute.mockRejectedValueOnce(new Error('Deletion failed'));

        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        await act(async () => {
            await deleteConfirmButton!.props.onPress();
        });

        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBeGreaterThan(0);
        expect(countRecordCards(root.root)).toBe(1);

        // The initial load and nothing since: a failed delete triggers no refresh.
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(1);

        expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to delete record'));
    });
});

describe('ObservationDetailsScreen Observation Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(defaultObservation);
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
    });

    async function openObservationMenu(root: any) {
        await act(async () => {
            root.root.findAllByProps({accessibilityLabel: 'More options'})[0].props.onPress();
        });
    }

    /** The menu's items, top to bottom, as their visible text. */
    function menuItems(root: any): string[] {
        const texts = root.root
            .findAll((node: any) => node.children?.length === 1 && typeof node.children[0] === 'string')
            .map((node: any) => node.children[0])
            .filter((text: string) => text === 'Edit' || text === 'Delete');
        return [...new Set<string>(texts)];
    }

    it('holds Edit above Delete', async () => {
        const root = await renderScreen();

        await openObservationMenu(root);

        expect(menuItems(root)).toEqual(['Edit', 'Delete']);
    });

    it('opens the edit form for this Observation and closes the menu', async () => {
        const navigate = vi.fn();
        const root = await renderScreen(navigate);
        await openObservationMenu(root);

        await act(async () => {
            root.root.findAllByProps({accessibilityLabel: 'Edit observation'})[0].props.onPress();
        });

        expect(navigate).toHaveBeenCalledWith('EditObservation', {observationId: 'obs-1'});
        expect(menuItems(root)).toEqual([]);
    });
});

describe('ObservationDetailsScreen Record Values', () => {
    const observationWithBoolean = {
        id: 'obs-1',
        name: 'Test Observation',
        createdAt: CREATED_AT,
        metrics: [
            {id: 'm1', name: 'Note', type: 'Text'},
            {id: 'm2', name: 'Well Rested', type: 'Boolean'},
        ],
    } as unknown as Observation;

    function recordHolding(values: [string, unknown][]): DomainRecord {
        return {
            id: 'rec-1',
            observationId: 'obs-1',
            timestamp: new Date('2026-07-04T12:00:00Z'),
            values: new Map(values),
        } as unknown as DomainRecord;
    }

    async function expandRecord(root: any) {
        await act(async () => {
            findRecordHeader(root.root).props.onPress();
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(observationWithBoolean);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        vi.stubGlobal('alert', vi.fn());
    });

    it.each([[true, 'Yes'], [false, 'No']])(
        'shows a Boolean %s as "%s" - the same word its input offers, never the raw value',
        async (stored, label) => {
            mockGetRecentRecordsExecute.mockResolvedValue([
                recordHolding([['m1', 'slept badly'], ['m2', stored]]),
            ]);
            const root = await renderScreen();

            await expandRecord(root);

            expect(findAllByText(root.root, label).length).toBeGreaterThan(0);
            expect(findAllByText(root.root, String(stored)).length).toBe(0);
        },
    );

    it('shows a placeholder for a Metric the Record holds no value for', async () => {
        mockGetRecentRecordsExecute.mockResolvedValue([recordHolding([['m1', 'slept badly']])]);
        const root = await renderScreen();

        await expandRecord(root);

        expect(findAllByText(root.root, '-').length).toBeGreaterThan(0);
    });

    // Against an Observation whose Metric is itself named "Note" - the collision
    // the note has to stay legible through.
    describe('record note', () => {
        const NOTE = 'The bed was terrible';

        function noteGlyphs(root: any) {
            return root.root.findAllByProps({name: 'sticky-note-2'});
        }

        function noted(note: string | null): DomainRecord {
            return new DomainRecord(
                'rec-1',
                'obs-1',
                new Date('2026-07-04T12:00:00Z'),
                new Map([['m1', 'slept badly']]),
                note,
            );
        }

        it('marks a noted Record\'s collapsed row with a glyph, labelled for a screen reader', async () => {
            mockGetRecentRecordsExecute.mockResolvedValue([noted(NOTE)]);
            const root = await renderScreen();

            const glyphs = noteGlyphs(root);
            expect(glyphs.length).toBe(1);
            expect(glyphs[0].props.accessibilityLabel).toBe('Has a note');
            expect(findAllByText(root.root, NOTE).length).toBe(0);
        });

        it('leaves nothing in its place on an un-noted Record', async () => {
            mockGetRecentRecordsExecute.mockResolvedValue([noted(null)]);
            const root = await renderScreen();

            expect(noteGlyphs(root).length).toBe(0);

            await expandRecord(root);

            expect(noteGlyphs(root).length).toBe(0);
        });

        it('shows the note itself once the Record is expanded', async () => {
            mockGetRecentRecordsExecute.mockResolvedValue([noted(NOTE)]);
            const root = await renderScreen();

            await expandRecord(root);

            expect(findAllByText(root.root, NOTE).length).toBe(1);
        });
    });
});

describe('ObservationDetailsScreen Metadata Line', () => {
    const DESCRIPTION = 'How well I slept';

    function observationCreated(createdAt: Date, description: string | null = null): Observation {
        return {
            id: 'obs-1',
            name: 'Sleep Quality',
            description,
            createdAt,
            metrics: [{id: 'm1', name: 'Hours', type: 'Numeric'}],
        } as unknown as Observation;
    }

    /** The line as the screen writes it, in whatever date format the device runs. */
    function metadataLine(createdAt: Date, count: string): string {
        return `Created ${createdAt.toLocaleDateString()} · ${count}`;
    }

    /** Every line of text on the screen, in the order it lays them out. */
    function textLines(root: any): string[] {
        return root.root
            .findAllByType(Text)
            .map((node: any) => node.props.children)
            .filter((child: any) => typeof child === 'string');
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(observationCreated(CREATED_AT, DESCRIPTION));
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        mockDeleteRecordExecute.mockResolvedValue(undefined);
        vi.stubGlobal('alert', vi.fn());
    });

    it('states when the Observation was created and how many Records it holds', async () => {
        mockCountRecordsExecute.mockResolvedValueOnce(12);

        const root = await renderScreen();

        expect(mockCountRecordsExecute).toHaveBeenCalledWith('obs-1');
        expect(findAllByText(root.root, metadataLine(CREATED_AT, '12 records')).length).toBe(1);
    });

    it('sits under the description where there is one', async () => {
        mockCountRecordsExecute.mockResolvedValueOnce(12);

        const root = await renderScreen();

        expect(textLines(root).slice(0, 3)).toEqual([
            'Sleep Quality',
            DESCRIPTION,
            metadataLine(CREATED_AT, '12 records'),
        ]);
    });

    it('sits under the title where there is no description', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(observationCreated(CREATED_AT));
        mockCountRecordsExecute.mockResolvedValueOnce(12);

        const root = await renderScreen();

        expect(textLines(root).slice(0, 2)).toEqual([
            'Sleep Quality',
            metadataLine(CREATED_AT, '12 records'),
        ]);
    });

    // Two different statements in two places: the line counts the Observation's
    // Records, RECENT RECORDS says the section below it has none to show.
    it('reads No records for an Observation with none, above the section\'s own empty text', async () => {
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockCountRecordsExecute.mockResolvedValueOnce(0);

        const root = await renderScreen();

        expect(findAllByText(root.root, metadataLine(CREATED_AT, 'No records')).length).toBe(1);
        expect(findAllByText(root.root, 'No records yet.').length).toBe(1);
    });

    it('announces the line as one phrase, the separator read as a comma', async () => {
        mockCountRecordsExecute.mockResolvedValueOnce(1);

        const root = await renderScreen();

        const line = root.root.findAllByProps({
            accessibilityLabel: `Created ${CREATED_AT.toLocaleDateString()}, 1 record`,
        });
        expect(line.length).toBeGreaterThan(0);
    });

    it('re-reads the count after a Record is deleted without leaving the screen', async () => {
        mockCountRecordsExecute.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
        const root = await renderScreen();
        expect(findAllByText(root.root, metadataLine(CREATED_AT, '2 records')).length).toBe(1);

        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);
        await act(async () => {
            await findTouchableWithText(root.root, 'Delete')!.props.onPress();
        });

        expect(findAllByText(root.root, metadataLine(CREATED_AT, '1 record')).length).toBe(1);
    });
});

describe('ObservationDetailsScreen Trends', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(defaultObservation);
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        vi.stubGlobal('alert', vi.fn());
    });

    it('renders one chart per Numeric Metric', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            numericObservation({id: 'm1', name: 'Duration'}, {id: 'm2', name: 'Quality'}),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5], ['m2', 50]]),
            chartRecord('b', 1, [['m1', 7], ['m2', 55]]),
        ]);

        const root = await renderScreen();

        expect(findAllByText(root.root, 'TRENDS').length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(0);
    });

    // Every declared type has a renderer, so the section is omitted only for an
    // Observation holding no Metrics at all - which `validateCreateObservation`
    // refuses and no route creates.
    it('omits the TRENDS section for an Observation carrying no Metrics at all', async () => {
        mockGetObservationByIdExecute.mockResolvedValue({
            id: 'obs-1',
            name: 'Journal',
            createdAt: CREATED_AT,
            metrics: [],
        } as unknown as Observation);

        const root = await renderScreen();

        expect(findAllByText(root.root, 'TRENDS').length).toBe(0);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(0);
        // The selector belongs to the section, so it goes away with it - the
        // Custom segment and its modal included.
        expect(root.root.findAllByProps({testID: 'time-range-preset-1M'}).length).toBe(0);
        expect(root.root.findAllByProps({testID: 'time-range-custom'}).length).toBe(0);
    });

    it('renders the section, its selector and a card for an Observation whose only Metric is Text', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf({id: 't1', name: 'Notes', type: 'Text'}),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['t1', 'slept badly']]),
        ]);

        const root = await renderScreen();

        expect(findAllByText(root.root, 'TRENDS').length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'time-range-preset-1M'}).length).toBeGreaterThan(0);
        expect(chartedMetricNames(root)).toEqual(['Notes']);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
    });

    it('draws each card at the height its own Metric type is registered at', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf(
                {id: 'm1', name: 'Duration', type: 'Numeric'},
                {id: 't1', name: 'Notes', type: 'Text'},
            ),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5], ['t1', 'slept badly']]),
            chartRecord('b', 1, [['m1', 7], ['t1', 'slept well']]),
        ]);

        const root = await renderScreen();

        expect(chartBoxHeights(root)).toEqual([NUMERIC_CARD_HEIGHT, TEXT_CARD_HEIGHT]);
        expect(rendererHeights(root)).toEqual(chartBoxHeights(root));
    });

    it('gives a Metric no Record in the window a placeholder as tall as its chart', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf(
                {id: 'm1', name: 'Duration', type: 'Numeric'},
                {id: 't1', name: 'Notes', type: 'Text'},
            ),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);

        const root = await renderScreen();

        expect(heightsOf(root, 'trend-empty')).toEqual([NUMERIC_CARD_HEIGHT, TEXT_CARD_HEIGHT]);
    });

    it('renders a card for every Metric a renderer can draw, in declaration order', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf(
                {id: 'm1', name: 'Duration', type: 'Numeric'},
                enumMetric('e1', 'mood', ['low', 'ok', 'high']),
                {id: 'b1', name: 'Done', type: 'Boolean'},
                {id: 'm2', name: 'Quality', type: 'Numeric'},
            ),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5], ['e1', 'low'], ['b1', true], ['m2', 50]]),
            chartRecord('b', 1, [['m1', 7], ['e1', 'high'], ['b1', false], ['m2', 55]]),
        ]);

        const root = await renderScreen();

        // Interleaved by declaration rather than grouped by type.
        expect(chartedMetricNames(root)).toEqual(['Duration', 'mood', 'Done', 'Quality']);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(4);
    });

    it('renders the section and its selector for an Observation carrying no Numeric Metric', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf(enumMetric('e1', 'mood', ['low', 'ok', 'high']), {
                id: 't1',
                name: 'Notes',
                type: 'Text',
            }),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['e1', 'low'], ['t1', 'slept badly']]),
            chartRecord('b', 1, [['e1', 'high'], ['t1', 'slept well']]),
        ]);

        const root = await renderScreen();

        expect(findAllByText(root.root, 'TRENDS').length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'time-range-preset-1M'}).length).toBeGreaterThan(0);
        expect(chartedMetricNames(root)).toEqual(['mood', 'Notes']);
    });

    // The section and the selector previously went with it, so this Observation
    // is the one whose Trends the slice brought into existence.
    it('renders the section and its selector for an Observation whose only Metric is a Boolean', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf({id: 'b1', name: 'Done', type: 'Boolean'}),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['b1', true]]),
            chartRecord('b', 1, [['b1', false]]),
        ]);

        const root = await renderScreen();

        expect(findAllByText(root.root, 'TRENDS').length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'time-range-preset-1M'}).length).toBeGreaterThan(0);
        expect(chartedMetricNames(root)).toEqual(['Done']);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
    });

    it('shows the placeholder for an Enum Metric no Record in the window answered', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf(enumMetric('e1', 'mood', ['low', 'ok', 'high'])),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);

        const root = await renderScreen();

        expect(findAllByText(root.root, TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(1);
    });

    it('opens the Record behind an Enum column standing for exactly one', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf(enumMetric('e1', 'mood', ['low', 'ok', 'high'])),
        );
        // Two days apart at the default 1M window, so each keeps its own bucket
        // and its column stands for a single Record.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('earliest', 3, [['e1', 'low']]),
            chartRecord('latest', 1, [['e1', 'high']]),
        ]);
        const navigate = vi.fn();

        const root = await renderScreen(navigate);
        await pressSwimlaneColumn(root);

        expect(navigate).toHaveBeenCalledWith('EditRecord', {
            observationId: 'obs-1',
            recordId: 'earliest',
        });
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(1);
    });

    it('still opens the Record behind a Numeric point on an Observation carrying an Enum card too', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            observationOf(
                {id: 'm1', name: 'Duration', type: 'Numeric'},
                enumMetric('e1', 'mood', ['low', 'ok', 'high']),
            ),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('earliest', 3, [['m1', 5], ['e1', 'low']]),
            chartRecord('latest', 1, [['m1', 5], ['e1', 'high']]),
        ]);
        const navigate = vi.fn();

        const root = await renderScreen(navigate);
        await pressChartPoint(root);

        expect(navigate).toHaveBeenCalledWith('EditRecord', {observationId: 'obs-1', recordId: 'earliest'});
    });

    it('shows the insufficient-data message for a Metric with no points in the window', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);

        const root = await renderScreen();

        expect(findAllByText(root.root, TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(0);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(1);
    });

    it('charts a Metric with a single point, and opens its Record on tap', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 1, [['m1', 5]]),
        ]);
        const navigate = vi.fn();

        const root = await renderScreen(navigate);

        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(0);

        await pressChartPoint(root);

        expect(navigate).toHaveBeenCalledWith('EditRecord', {observationId: 'obs-1', recordId: 'a'});
    });

    it('opens the record behind a tapped chart point', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        // Same value in both records so the series is flat (points sit at the
        // canvas mid-line), keeping the tap's vertical hit-test independent of the
        // chart's unmeasured width in the test renderer.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('earliest', 3, [['m1', 5]]),
            chartRecord('latest', 1, [['m1', 5]]),
        ]);
        const navigate = vi.fn();

        const root = await renderScreen(navigate);

        const pressable = root.root.findByProps({testID: 'numeric-trend-chart-pressable'});
        await act(async () => {
            // 32 is the plot's left edge, where an unmeasured chart's points all
            // collapse; 45 the mid-line of the 90px chart, where a flat series sits.
            pressable.props.onPress({nativeEvent: {locationX: 32, locationY: 45}});
        });

        expect(navigate).toHaveBeenCalledWith('EditRecord', {observationId: 'obs-1', recordId: 'earliest'});
    });

    it('renders the RECENT RECORDS section independently of the trends data fetch', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5]]),
            chartRecord('b', 1, [['m1', 7]]),
        ]);

        const root = await renderScreen();

        // Recent records renders its own record card from its own fetch...
        expect(countRecordCards(root.root)).toBe(1);
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(1);
        // ...while the trend chart is populated from a separate range-scoped fetch.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(1);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
    });
});

describe('ObservationDetailsScreen Time Range Selector', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        vi.stubGlobal('alert', vi.fn());
    });

    function expectWindow(range: TimeRange, expectedWindowMs: number) {
        expect(range.end.getTime() - range.start.getTime()).toBe(expectedWindowMs);
        // Every preset is a window ending now, computed as the fetch is issued.
        expect(Date.now() - range.end.getTime()).toBeLessThan(5000);
    }

    it('selects the one-month preset by default', async () => {
        const root = await renderScreen();

        const selectedStates = (['1D', '1W', '1M', '1Y'] as TimeRangePreset[]).map(
            preset => presetSegment(root, preset).props.accessibilityState.selected,
        );

        expect(selectedStates).toEqual([false, false, true, false]);
    });

    it('loads the default 30-day window without being asked', async () => {
        await renderScreen();

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(1);
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledWith('obs-1', expect.anything());
        expectWindow(lastRequestedRange(), 30 * DAY_MS);
    });

    it.each<[TimeRangePreset, number]>([
        ['1D', DAY_MS],
        ['1W', 7 * DAY_MS],
        ['1Y', 365 * DAY_MS],
    ])('re-fetches Records over the %s window when that preset is selected', async (preset, expectedWindowMs) => {
        const root = await renderScreen();

        await selectPreset(root, preset);

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(2);
        expectWindow(lastRequestedRange(), expectedWindowMs);
        expect(presetSegment(root, preset).props.accessibilityState.selected).toBe(true);
        expect(presetSegment(root, '1M').props.accessibilityState.selected).toBe(false);
    });

    it('re-buckets the charts at the selected preset resolution', async () => {
        // Three Records a couple of hours apart: one day-bucket under "1M", three
        // hour-buckets under "1D".
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecordHoursAgo('a', 6, [['m1', 5]]),
            chartRecordHoursAgo('b', 4, [['m1', 7]]),
            chartRecordHoursAgo('c', 2, [['m1', 6]]),
        ]);

        const root = await renderScreen();

        expect(recordDots(root).length).toBe(1);

        await selectPreset(root, '1D');

        expect(recordDots(root).length).toBe(3);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(0);
    });

    // Three Records spread across a 30-day window, then a switch to 1Y left
    // hanging: bucketing them by the incoming size while the old window is still
    // on screen puts all three in one 30-day bucket.
    it('keeps the charts on the fetched window while the next one is in flight', async () => {
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 20, [['m1', 5]]),
            chartRecord('b', 10, [['m1', 5]]),
            chartRecord('c', 2, [['m1', 5]]),
        ]);
        const root = await renderScreen();
        expect(recordDots(root).length).toBe(3);

        let arrive: (records: DomainRecord[]) => void = () => {};
        mockGetRecordsByTimeRangeExecute.mockReturnValue(
            new Promise<DomainRecord[]>(resolve => {
                arrive = resolve;
            }),
        );
        await selectPreset(root, '1Y');

        expect(recordDots(root).length).toBe(3);

        // Ten months apart, so the year's 30-day buckets hold one each.
        await act(async () => {
            arrive([chartRecord('a', 300, [['m1', 5]]), chartRecord('b', 2, [['m1', 5]])]);
        });

        expect(recordDots(root).length).toBe(2);
    });

    it('drives every Numeric chart from the one selection', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            numericObservation({id: 'm1', name: 'Duration'}, {id: 'm2', name: 'Quality'}),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5], ['m2', 50]]),
            chartRecord('b', 1, [['m1', 7], ['m2', 55]]),
        ]);

        const root = await renderScreen();

        await selectPreset(root, '1W');

        // One fetch for the switch, not one per chart, and both charts follow it.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(2);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);
    });

    it('keeps the insufficient-data state per Metric within the selected window', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            numericObservation({id: 'm1', name: 'Dense'}, {id: 'm2', name: 'Sparse'}),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            // "Dense" keeps two points within the last day; "Sparse" has none there,
            // though both have plenty across the month.
            chartRecordHoursAgo('a', 6, [['m1', 5]]),
            chartRecordHoursAgo('b', 2, [['m1', 7]]),
            chartRecord('c', 5, [['m1', 6]]),
            chartRecord('d', 20, [['m2', 50]]),
            chartRecord('e', 10, [['m2', 55]]),
        ]);

        const root = await renderScreen();

        // Over a month both Metrics have enough data...
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);

        await selectPreset(root, '1D');

        // ...but over a day only "Dense" does, and the other falls back on its own.
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(1);
        expect(findAllByText(root.root, TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
    });

    it('leaves the RECENT RECORDS section alone when the preset changes', async () => {
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);

        const root = await renderScreen();

        await selectPreset(root, '1W');
        await selectPreset(root, '1Y');

        // Recent Records was fetched once, on load, and still shows its own record.
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(1);
        expect(countRecordCards(root.root)).toBe(1);
    });

    it('disables the selector while a switch is in flight', async () => {
        let releaseFetch: (records: DomainRecord[]) => void = () => {};
        mockGetRecordsByTimeRangeExecute.mockReturnValueOnce(
            new Promise(resolve => {
                releaseFetch = resolve;
            }),
        );

        const root = await renderScreen();

        expect(presetSegment(root, '1D').props.disabled).toBe(true);
        expect(customSegment(root).props.disabled).toBe(true);

        await act(async () => {
            releaseFetch([]);
        });

        expect(presetSegment(root, '1D').props.disabled).toBe(false);
        expect(customSegment(root).props.disabled).toBe(false);
    });

    it('keeps the charts and the selection intact when a switch fails', async () => {
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5]]),
            chartRecord('b', 1, [['m1', 7]]),
        ]);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const root = await renderScreen();
        mockGetRecordsByTimeRangeExecute.mockRejectedValueOnce(new Error('Query failed'));

        await selectPreset(root, '1W');

        // The failure is surfaced, the previous chart stays, and the selector is
        // usable again rather than stuck disabled.
        expect(consoleError).toHaveBeenCalledWith('Failed to load trend data', expect.any(Error));
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
        expect(presetSegment(root, '1W').props.disabled).toBe(false);

        consoleError.mockRestore();
    });
});

describe('ObservationDetailsScreen Custom Time Range', () => {
    const ALL_PRESETS: TimeRangePreset[] = ['1D', '1W', '1M', '1Y'];

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        vi.stubGlobal('alert', vi.fn());
    });

    it("opens the modal pre-filled from the active preset's concrete window", async () => {
        const root = await renderScreen();

        await selectPreset(root, '1W');
        await openCustomModal(root);

        expect(customRangeFieldValue(root, 'start')).toBe(formatShortDate(dayAt(7)));
        expect(customRangeFieldValue(root, 'end')).toBe(formatShortDate(dayAt(0)));
    });

    it('re-fetches Records over the applied custom window', async () => {
        const root = await renderScreen();

        await applyCustomRange(root, 4);

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(2);
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith('obs-1', {
            start: dayAt(4),
            end: endOfDay(dayAt(0)),
        });
    });

    it('re-buckets the charts at the applied window resolution', async () => {
        // Three Records a couple of hours apart: one day-bucket under "1M",
        // separate four-hour buckets over a five-day custom window, which targets
        // ~30 buckets rather than a preset's fixed size.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecordHoursAgo('a', 6, [['m1', 5]]),
            chartRecordHoursAgo('b', 4, [['m1', 7]]),
            chartRecordHoursAgo('c', 2, [['m1', 6]]),
        ]);

        const root = await renderScreen();
        expect(recordDots(root).length).toBe(1);

        await applyCustomRange(root, 4);

        expect(recordDots(root).length).toBeGreaterThan(1);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(0);
    });

    it('labels the Custom segment with the applied range and deselects every preset', async () => {
        const root = await renderScreen();

        await applyCustomRange(root, 4);

        expect(customSegment(root).props.accessibilityState.selected).toBe(true);
        expect(
            ALL_PRESETS.map(preset => presetSegment(root, preset).props.accessibilityState.selected),
        ).toEqual([false, false, false, false]);
        expect(findAllByText(root.root, formatTimeRange(lastRequestedRange())).length).toBeGreaterThan(0);
        // The parent closed the modal in the same update that applied the range.
        expect(findAllByText(root.root, 'Custom time range').length).toBe(0);
    });

    it('drops the applied range as soon as a preset is selected', async () => {
        const root = await renderScreen();
        await applyCustomRange(root, 4);
        const appliedLabel = formatTimeRange(lastRequestedRange());

        await selectPreset(root, '1W');

        expect(presetSegment(root, '1W').props.accessibilityState.selected).toBe(true);
        expect(customSegment(root).props.accessibilityState.selected).toBe(false);
        // The segment reverts rather than keeping a stale range on show.
        expect(findAllByText(root.root, appliedLabel).length).toBe(0);
        expect(findAllByText(root.root, 'Custom').length).toBeGreaterThan(0);

        const range = lastRequestedRange();
        expect(range.end.getTime() - range.start.getTime()).toBe(7 * DAY_MS);
    });

    it('changes neither the selection nor the charts when the modal is cancelled', async () => {
        const root = await renderScreen();

        await openCustomModal(root);
        await pickCustomDay(root, 'start', dayAt(4));
        await pressCustomModalButton(root, 'Cancel');

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(1);
        expect(presetSegment(root, '1M').props.accessibilityState.selected).toBe(true);
        expect(customSegment(root).props.accessibilityState.selected).toBe(false);
        expect(findAllByText(root.root, 'Custom time range').length).toBe(0);
    });

    it('leaves the RECENT RECORDS section alone across the whole custom flow', async () => {
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);

        const root = await renderScreen();

        await applyCustomRange(root, 4);

        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(1);
        expect(countRecordCards(root.root)).toBe(1);
    });

});

/**
 * A point standing for several Records drills into them rather than opening one
 * of them arbitrarily: the section's window narrows onto the Records themselves,
 * as an ordinary Custom selection.
 *
 * Most of these work from `1Y`. A zoom needs a point whose earliest and latest
 * Records are a day or more apart, and only a bucket wider than a day can hold
 * one - which among the presets means `1Y`'s 30-day buckets alone.
 */
describe('ObservationDetailsScreen Chart Zoom', () => {
    const ALL_PRESETS: TimeRangePreset[] = ['1D', '1W', '1M', '1Y'];

    // Calendar days decide every window a zoom produces, so this suite pins the
    // clock instead of working in "days ago". Both things these tests turn on -
    // whether two Records share a day, and which bucket they land in, buckets
    // being anchored at the window's end rather than at midnight - would
    // otherwise depend on the hour the suite happened to run at.
    const NOW = new Date(2026, 6, 15, 10, 30);

    /** The whole calendar days a tap on the point covering these Records zooms to. */
    function daysCovering(first: DomainRecord, last: DomainRecord): TimeRange {
        return {start: dayOf(first.timestamp), end: endOfDay(last.timestamp)};
    }

    // Two Records five days apart sharing one of `1Y`'s 30-day buckets - that
    // bucket runs May 11 to Jun 10 - plus a third in the next bucket along so
    // the chart has a second point to draw.
    const spanStart = recordAt('span-start', on(5, 26));
    const spanEnd = recordAt('span-end', on(5, 31));
    const nextBucket = recordAt('next-bucket', on(6, 25));

    // The same three Records answered for a Choice Metric as well, so the
    // section draws a swimlane beside the curve and the two Records sharing a
    // 30-day bucket share a column of it.
    const observationWithMood = observationOf(
        {id: 'm1', name: 'Duration', type: 'Numeric'},
        enumMetric('e1', 'mood', ['low', 'ok', 'high']),
    );
    const moodRecords = [
        recordAt('span-start', on(5, 26), [['m1', 5], ['e1', 'low']]),
        recordAt('span-end', on(5, 31), [['m1', 5], ['e1', 'high']]),
        recordAt('next-bucket', on(6, 25), [['m1', 5], ['e1', 'ok']]),
    ];

    beforeEach(() => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        vi.setSystemTime(NOW);
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([spanStart, spanEnd, nextBucket]);
        vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('zooms to the calendar days its Records cover, not the bucket holding them', async () => {
        const navigate = vi.fn();
        const root = await renderScreen(navigate);
        await selectPreset(root, '1Y');

        await pressChartPoint(root);

        expect(navigate).not.toHaveBeenCalled();
        // May 26 through May 31, whole days: the six the two Records fall across.
        // Not the 30-day bucket behind the point, which starts back on May 11 and
        // runs ten days past the later Record.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith('obs-1', {
            start: on(5, 26, 0),
            end: on(6, 1, 0),
        });
    });

    it('shows the zoomed window as the active Custom selection', async () => {
        const root = await renderScreen();
        await selectPreset(root, '1Y');

        await pressChartPoint(root);

        expect(customSegment(root).props.accessibilityState.selected).toBe(true);
        expect(
            ALL_PRESETS.map(preset => presetSegment(root, preset).props.accessibilityState.selected),
        ).toEqual([false, false, false, false]);
        expect(
            findAllByText(root.root, formatTimeRange(daysCovering(spanStart, spanEnd))).length,
        ).toBeGreaterThan(0);
    });

    it('pre-fills the custom range modal from the zoomed window, and applying it changes nothing', async () => {
        const root = await renderScreen();
        await selectPreset(root, '1Y');

        await pressChartPoint(root);
        const zoomed = lastRequestedRange();
        await openCustomModal(root);

        // A zoom is a custom range like any other, so the modal shows the days it
        // covers...
        expect(customRangeFieldValue(root, 'start')).toBe(formatShortDate(spanStart.timestamp));
        expect(customRangeFieldValue(root, 'end')).toBe(formatShortDate(spanEnd.timestamp));

        await pressCustomModalButton(root, 'Apply');

        // ...and re-applying those days reproduces the very same window. Only a
        // window already aligned to whole days survives that round trip, which is
        // why a zoom aligns rather than stopping at its Records' own instants.
        expect(lastRequestedRange()).toEqual(zoomed);
    });

    it('re-scopes every Numeric chart in the section, not just the tapped one', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            numericObservation({id: 'm1', name: 'Duration'}, {id: 'm2', name: 'Quality'}),
        );
        const paired: [string, number][] = [['m1', 5], ['m2', 50]];
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('span-start', on(5, 26), paired),
            recordAt('span-end', on(5, 31), paired),
            recordAt('next-bucket', on(6, 25), paired),
        ]);

        const root = await renderScreen();
        await selectPreset(root, '1Y');
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);
        const beforeZoom = mockGetRecordsByTimeRangeExecute.mock.calls.length;

        await pressChartPoint(root);

        // One fetch for the zoom, not one per chart, and both charts follow it
        // into the narrower window - where the Records folded together sit five
        // days apart instead of averaged into one point.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(beforeZoom + 1);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(0);
    });

    it('still opens the Record behind a point that stands for exactly one', async () => {
        // Two days apart at the default 1M window, so each keeps its own bucket.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('earliest', on(7, 10)),
            recordAt('latest', on(7, 12)),
        ]);
        const navigate = vi.fn();

        const root = await renderScreen(navigate);

        await pressChartPoint(root);

        expect(navigate).toHaveBeenCalledWith('EditRecord', {
            observationId: 'obs-1',
            recordId: 'earliest',
        });
        // Navigating is not zooming: the window is left exactly as it was.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(1);
        expect(presetSegment(root, '1M').props.accessibilityState.selected).toBe(true);
        expect(customSegment(root).props.accessibilityState.selected).toBe(false);
    });

    it('zooms to the single day its Records share', async () => {
        // Both inside one of 1M's day-wide buckets and on the same calendar day.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('midday', on(7, 3, 12)),
            recordAt('afternoon', on(7, 3, 14)),
            recordAt('later-day', on(7, 8)),
        ]);
        const root = await renderScreen();

        await pressChartPoint(root);

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith('obs-1', {
            start: on(7, 3, 0),
            end: on(7, 4, 0),
        });
    });

    it('covers both days when the tapped Records straddle midnight', async () => {
        // 1M's buckets are day-wide but anchored at the window's end, not at
        // midnight, so one of them spans the evening of a day and the morning of
        // the next. A point folding two such Records covers two calendar days.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('evening', on(7, 3, 20)),
            recordAt('next-morning', on(7, 4, 9)),
            recordAt('later-day', on(7, 8)),
        ]);
        const root = await renderScreen();

        await pressChartPoint(root);

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith('obs-1', {
            start: on(7, 3, 0),
            end: on(7, 5, 0),
        });
    });

    /**
     * Zoom is a ladder, not a single step: each tap narrows onto the days its
     * Records occupy, and a day is as narrow as whole days go, so the ladder ends
     * there rather than needing a floor of its own to say when to stop.
     */
    it('keeps zooming until a day is displayed, then stops', async () => {
        // One cluster within an hour, a second later the same day, and two more
        // Records spread out beyond - enough that every window along the way
        // still has two points to draw and an aggregated one to tap.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('cluster-a', on(5, 26, 12)),
            recordAt('cluster-b', new Date(2026, 4, 26, 12, 30)),
            recordAt('same-day-evening', on(5, 26, 18)),
            spanEnd,
            nextBucket,
        ]);
        const navigate = vi.fn();
        const root = await renderScreen(navigate);
        await selectPreset(root, '1Y');

        // A year, down to the six days its 30-day bucket's Records cover...
        await pressChartPoint(root);
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith('obs-1', {
            start: on(5, 26, 0),
            end: on(6, 1, 0),
        });

        // ...down again to the one day the next point's Records share.
        await pressChartPoint(root);
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith('obs-1', {
            start: on(5, 26, 0),
            end: on(5, 27, 0),
        });
        const atTheLimit = mockGetRecordsByTimeRangeExecute.mock.calls.length;

        // The day is bucketed by the hour, and the two Records sharing an hour
        // share a day too, so there is no narrower window left to ask for.
        await pressChartPoint(root);

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(atTheLimit);
        expect(navigate).not.toHaveBeenCalled();
        expect(customSegment(root).props.accessibilityState.selected).toBe(true);
    });

    it('does nothing at 1D, whose window is already a single day', async () => {
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('same-hour-a', on(7, 15, 5)),
            recordAt('same-hour-b', new Date(2026, 6, 15, 5, 20)),
            recordAt('later-hour', on(7, 15, 8)),
        ]);
        const navigate = vi.fn();
        const root = await renderScreen(navigate);

        await selectPreset(root, '1D');
        const beforeTap = mockGetRecordsByTimeRangeExecute.mock.calls.length;

        await pressChartPoint(root);

        // Its hour-wide buckets can only ever hold Records of one day, which is
        // the width the window already has.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(beforeTap);
        expect(navigate).not.toHaveBeenCalled();
        expect(presetSegment(root, '1D').props.accessibilityState.selected).toBe(true);
        expect(customSegment(root).props.accessibilityState.selected).toBe(false);
    });

    it('narrows every card in the section on a swimlane column standing for several', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(observationWithMood);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue(moodRecords);
        const navigate = vi.fn();

        const root = await renderScreen(navigate);
        await selectPreset(root, '1Y');
        const beforeZoom = mockGetRecordsByTimeRangeExecute.mock.calls.length;

        await pressSwimlaneColumn(root);

        // The days the column's Records fall on, exactly as a Numeric point
        // folding the same two would have given - and the Numeric card beside it
        // follows the swimlane into that window rather than staying at 1Y.
        expect(navigate).not.toHaveBeenCalled();
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(beforeZoom + 1);
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith(
            'obs-1',
            daysCovering(moodRecords[0], moodRecords[1]),
        );
        expect(customSegment(root).props.accessibilityState.selected).toBe(true);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);
    });

    it('ignores a swimlane press arriving while the section is still fetching', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(observationWithMood);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue(moodRecords);
        const navigate = vi.fn();

        const root = await renderScreen(navigate);
        await selectPreset(root, '1Y');

        let releaseFetch: (records: DomainRecord[]) => void = () => {};
        mockGetRecordsByTimeRangeExecute.mockReturnValueOnce(
            new Promise(resolve => {
                releaseFetch = resolve;
            }),
        );

        await pressSwimlaneColumn(root);
        const inFlight = mockGetRecordsByTimeRangeExecute.mock.calls.length;

        await pressSwimlaneColumn(root);

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(inFlight);
        expect(navigate).not.toHaveBeenCalled();

        await act(async () => {
            releaseFetch([]);
        });

        expect(customSegment(root).props.accessibilityState.selected).toBe(true);
    });

    it('ignores a second tap while the first one is still loading', async () => {
        const navigate = vi.fn();
        const root = await renderScreen(navigate);
        await selectPreset(root, '1Y');

        let releaseFetch: (records: DomainRecord[]) => void = () => {};
        mockGetRecordsByTimeRangeExecute.mockReturnValueOnce(
            new Promise(resolve => {
                releaseFetch = resolve;
            }),
        );

        await pressChartPoint(root);
        const inFlight = mockGetRecordsByTimeRangeExecute.mock.calls.length;

        await pressChartPoint(root);

        // The second tap is dropped rather than stacking a reload on the one in
        // flight, so the section settles on the first tap's window.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(inFlight);
        expect(navigate).not.toHaveBeenCalled();
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith(
            'obs-1',
            daysCovering(spanStart, spanEnd),
        );

        await act(async () => {
            releaseFetch([]);
        });

        expect(customSegment(root).props.accessibilityState.selected).toBe(true);
    });
});

/**
 * Zoom is a ladder. Tapping a point descends it; the system back button climbs
 * back up, one window per press.
 */
describe('ObservationDetailsScreen Back Unzoom', () => {
    // Pinned as in the zoom suite: which calendar days a zoom comes to rest on
    // decides every window here.
    const NOW = new Date(2026, 6, 15, 10, 30);

    // Two Records five days apart sharing one of `1Y`'s 30-day buckets, plus a
    // third in the next bucket along so the chart has a second point to draw.
    const spanStart = recordAt('span-start', on(5, 26));
    const spanEnd = recordAt('span-end', on(5, 31));
    const nextBucket = recordAt('next-bucket', on(6, 25));

    // The same three Records answered for a Choice Metric as well, so the
    // section draws a swimlane beside the curve and the two Records sharing a
    // 30-day bucket share a column of it.
    const observationWithMood = observationOf(
        {id: 'm1', name: 'Duration', type: 'Numeric'},
        enumMetric('e1', 'mood', ['low', 'ok', 'high']),
    );
    const moodRecords = [
        recordAt('span-start', on(5, 26), [['m1', 5], ['e1', 'low']]),
        recordAt('span-end', on(5, 31), [['m1', 5], ['e1', 'high']]),
        recordAt('next-bucket', on(6, 25), [['m1', 5], ['e1', 'ok']]),
    ];

    /** The six whole days a tap on that bucket's point zooms to. */
    const ZOOMED: TimeRange = {start: on(5, 26, 0), end: on(6, 1, 0)};

    const YEAR_MS = 365 * DAY_MS;

    function fetchCount(): number {
        return mockGetRecordsByTimeRangeExecute.mock.calls.length;
    }

    function selectedPresets(root: any): (TimeRangePreset | 'custom')[] {
        const presets = (['1D', '1W', '1M', '1Y'] as TimeRangePreset[]).filter(
            preset => presetSegment(root, preset).props.accessibilityState.selected,
        );
        return customSegment(root).props.accessibilityState.selected
            ? [...presets, 'custom']
            : presets;
    }

    beforeEach(() => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        vi.setSystemTime(NOW);
        // Screens rendered by earlier tests are never unmounted, so their
        // listeners would still answer this suite's presses.
        focusListeners.clear();
        blurListeners.clear();
        backPressListeners.clear();
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([spanStart, spanEnd, nextBucket]);
        vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** Renders at `1Y` and zooms into the point folding the two nearby Records. */
    async function renderZoomedFromYear(navigate: (name: string, params: unknown) => void = vi.fn()) {
        const root = await renderScreen(navigate);
        await selectPreset(root, '1Y');
        await pressChartPoint(root);
        expect(lastRequestedRange()).toEqual(ZOOMED);
        return root;
    }

    it('declines a press with nothing zoomed, leaving the window, the charts and navigation alone', async () => {
        const navigate = vi.fn();
        const root = await renderScreen(navigate);
        await selectPreset(root, '1Y');
        const beforePress = fetchCount();

        expect(await pressSystemBack()).toBe(false);

        expect(fetchCount()).toBe(beforePress);
        expect(selectedPresets(root)).toEqual(['1Y']);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('restores the pre-zoom window on a press, redrawing every Numeric chart at it', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            numericObservation({id: 'm1', name: 'Duration'}, {id: 'm2', name: 'Quality'}),
        );
        const paired: [string, number][] = [['m1', 5], ['m2', 50]];
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('span-start', on(5, 26), paired),
            recordAt('span-end', on(5, 31), paired),
            recordAt('next-bucket', on(6, 25), paired),
        ]);
        const navigate = vi.fn();
        const root = await renderZoomedFromYear(navigate);
        const zoomedFetches = fetchCount();

        expect(await pressSystemBack()).toBe(true);

        // One fetch for the unzoom, not one per chart.
        expect(fetchCount()).toBe(zoomedFetches + 1);
        expect(lastRequestedRange().end.getTime() - lastRequestedRange().start.getTime()).toBe(YEAR_MS);
        expect(selectedPresets(root)).toEqual(['1Y']);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('unwinds two zooms one press at a time, newest first, then declines', async () => {
        // A cluster within an hour, a second Record that same evening, and two
        // spread out beyond: enough for the ladder to have two rungs.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('cluster-a', on(5, 26, 12)),
            recordAt('cluster-b', new Date(2026, 4, 26, 12, 30)),
            recordAt('same-day-evening', on(5, 26, 18)),
            spanEnd,
            nextBucket,
        ]);
        const root = await renderZoomedFromYear();

        // Down again to the single day the next point's Records share.
        await pressChartPoint(root);
        expect(lastRequestedRange()).toEqual({start: on(5, 26, 0), end: on(5, 27, 0)});

        expect(await pressSystemBack()).toBe(true);
        expect(lastRequestedRange()).toEqual(ZOOMED);

        expect(await pressSystemBack()).toBe(true);
        expect(selectedPresets(root)).toEqual(['1Y']);
        const atTheTop = fetchCount();

        expect(await pressSystemBack()).toBe(false);
        expect(fetchCount()).toBe(atTheTop);
    });

    it('forgets the windows behind a zoom once a preset is selected', async () => {
        const root = await renderZoomedFromYear();

        await selectPreset(root, '1W');
        const beforePress = fetchCount();

        expect(await pressSystemBack()).toBe(false);
        expect(fetchCount()).toBe(beforePress);
        expect(selectedPresets(root)).toEqual(['1W']);
    });

    it('forgets the windows behind a zoom once a custom range is applied', async () => {
        const root = await renderZoomedFromYear();

        await openCustomModal(root);
        await pickCustomDay(root, 'start', on(7, 10, 0));
        await pickCustomDay(root, 'end', on(7, 14, 0));
        await pressCustomModalButton(root, 'Apply');
        expect(lastRequestedRange()).toEqual({start: on(7, 10, 0), end: on(7, 15, 0)});
        const beforePress = fetchCount();

        expect(await pressSystemBack()).toBe(false);
        expect(fetchCount()).toBe(beforePress);
        expect(selectedPresets(root)).toEqual(['custom']);
    });

    it('forgets nothing when the custom range modal is cancelled', async () => {
        const root = await renderZoomedFromYear();

        await openCustomModal(root);
        await pickCustomDay(root, 'start', on(7, 10, 0));
        await pressCustomModalButton(root, 'Cancel');

        expect(await pressSystemBack()).toBe(true);
        expect(selectedPresets(root)).toEqual(['1Y']);
    });

    it('leaves nothing to undo after a tap that opens a Record instead of zooming', async () => {
        // Two days apart at the default 1M window, so each keeps its own bucket
        // and the tapped point stands for one Record.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('earliest', on(7, 10)),
            recordAt('latest', on(7, 12)),
        ]);
        const navigate = vi.fn();
        const root = await renderScreen(navigate);

        await pressChartPoint(root);
        expect(navigate).toHaveBeenCalledWith('EditRecord', {observationId: 'obs-1', recordId: 'earliest'});
        const beforePress = fetchCount();

        expect(await pressSystemBack()).toBe(false);
        expect(fetchCount()).toBe(beforePress);
        expect(selectedPresets(root)).toEqual(['1M']);
    });

    it('leaves nothing to undo after a tap too narrow to zoom', async () => {
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            recordAt('same-hour-a', on(7, 15, 5)),
            recordAt('same-hour-b', new Date(2026, 6, 15, 5, 20)),
            recordAt('later-hour', on(7, 15, 8)),
        ]);
        const root = await renderScreen();
        await selectPreset(root, '1D');

        // A day is where zoom comes to rest, so the tap changes no window.
        await pressChartPoint(root);
        const beforePress = fetchCount();

        expect(await pressSystemBack()).toBe(false);
        expect(fetchCount()).toBe(beforePress);
        expect(selectedPresets(root)).toEqual(['1D']);
    });

    it('swallows a press while a window switch is in flight, and does not replay it', async () => {
        const root = await renderScreen();
        await selectPreset(root, '1Y');

        let releaseFetch: (records: DomainRecord[]) => void = () => {};
        mockGetRecordsByTimeRangeExecute.mockReturnValueOnce(
            new Promise(resolve => {
                releaseFetch = resolve;
            }),
        );
        await pressChartPoint(root);
        const inFlight = fetchCount();

        // Consumed, but nothing popped: that would stack a second reload on the
        // fetch in flight.
        expect(await pressSystemBack()).toBe(true);
        expect(fetchCount()).toBe(inFlight);

        await act(async () => {
            releaseFetch([spanStart, spanEnd, nextBucket]);
        });

        expect(fetchCount()).toBe(inFlight);
        expect(selectedPresets(root)).toEqual(['custom']);
        expect(lastRequestedRange()).toEqual(ZOOMED);
    });

    it('stops listening while another screen covers it, and unwinds again on return', async () => {
        const root = await renderZoomedFromYear();

        await blurScreen();

        // A `BackHandler` listener is global, so one left registered here would
        // unzoom these charts while the user was backing out of the screen above.
        expect(backPressListeners.size).toBe(0);

        await refocusScreen();

        // The history belongs to the visit, not to the listener.
        expect(selectedPresets(root)).toEqual(['custom']);
        expect(await pressSystemBack()).toBe(true);
        expect(selectedPresets(root)).toEqual(['1Y']);
    });
});

/**
 * The screen stays mounted while a Record screen sits on top of it, so it no
 * longer reloads by being rebuilt on the way back. These cover what has to
 * replace that.
 */
describe('ObservationDetailsScreen Focus Refresh', () => {
    beforeEach(() => {
        // Screens rendered by earlier tests are never unmounted, so their focus
        // listeners would still be in the set and would answer a refocus by
        // re-querying through the same shared mocks. Only this test's screen
        // should respond.
        focusListeners.clear();
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        vi.stubGlobal('alert', vi.fn());
    });

    it('reloads the Observation and its Recent Records when the screen regains focus', async () => {
        const root = await renderScreen();
        expect(countRecordCards(root.root)).toBe(0);

        // Stands in for a Record added on the screen above this one.
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);
        await refocusScreen();

        expect(mockGetObservationByIdExecute).toHaveBeenCalledTimes(2);
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(2);
        expect(countRecordCards(root.root)).toBe(1);
    });

    it('re-queries the trend data on focus so a Record added above shows up in the charts', async () => {
        const root = await renderScreen();
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(1);

        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5]]),
            chartRecord('b', 1, [['m1', 7]]),
        ]);
        await refocusScreen();

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(2);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
    });

    it('refreshes against the applied custom range rather than resetting to the default', async () => {
        const root = await renderScreen();
        await applyCustomRange(root, 4);
        const appliedRange = {start: dayAt(4), end: endOfDay(dayAt(0))};

        await refocusScreen();

        // Reloading data and resetting the window are different things, and only
        // the first is wanted: the refresh re-queries the window on show.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenLastCalledWith('obs-1', appliedRange);
        expect(customSegment(root).props.accessibilityState.selected).toBe(true);
        expect(findAllByText(root.root, formatTimeRange(appliedRange)).length).toBeGreaterThan(0);
    });

    it('refreshes against a selected preset rather than resetting to the default', async () => {
        const root = await renderScreen();
        await selectPreset(root, '1W');

        await refocusScreen();

        expect(lastRequestedRange().end.getTime() - lastRequestedRange().start.getTime()).toBe(7 * DAY_MS);
        expect(presetSegment(root, '1W').props.accessibilityState.selected).toBe(true);
    });

    it('leaves the Recent Records alone when only the window changes', async () => {
        const root = await renderScreen();

        await selectPreset(root, '1W');

        // A window switch is not a refresh - it re-scopes the charts only.
        expect(mockGetObservationByIdExecute).toHaveBeenCalledTimes(1);
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(1);
    });
});

/**
 * A chart point drawn as a bare dot says nothing about whether tapping it opens
 * a Record or zooms in. Reproduces the one shape the seeded `hourly` metric
 * comes to rest on - the day three back, holding two Records inside one clock
 * hour and a third that afternoon - to check the counts a user reads before
 * tapping match what a tap there actually does.
 */
describe('ObservationDetailsScreen Aggregated Point Labels', () => {
    // Which hour a Record lands in decides everything here, so the clock is
    // pinned rather than worked in "days ago". Late enough in the day that 1M's
    // day-wide buckets, anchored at the window's end, hold whole mornings.
    const NOW = new Date(2026, 6, 15, 22, 0);

    // The seeded `hourly` shape: a day carrying a 09:00 Record, a second half an
    // hour later sharing its clock hour, and a third in the afternoon - plus one
    // on a later day, so the un-zoomed chart has a second point to draw.
    const morning = recordAt('morning', on(7, 12, 9));
    const halfPast = recordAt('half-past', on(7, 12, 9, 30));
    const afternoon = recordAt('afternoon', on(7, 12, 15));
    const laterDay = recordAt('later-day', on(7, 14, 9));

    // The muted colour a count label is drawn in; the axis labels beside it use
    // the solid token, which is what tells the two apart here.
    const POINT_COUNT_LABEL_COLOR = withAlpha(COLORS.onSurfaceVariant, 0.65);

    // Every glyph a fixed width, since only the labels' text matters here.
    const fontStub = {
        measureText: (text: string) => ({x: 0, y: 0, width: text.length * 5, height: 9}),
        getMetrics: () => ({ascent: -7, descent: 2, leading: 0}),
    } as unknown as SkFont;

    function countLabels(root: any): string[] {
        return root.root
            .findAllByType(SkiaText)
            .map((label: any) => label.props)
            .filter((label: any) => label.color === POINT_COUNT_LABEL_COLOR)
            .map((label: any) => label.text);
    }

    beforeEach(() => {
        vi.useFakeTimers({shouldAdvanceTime: true});
        vi.setSystemTime(NOW);
        vi.clearAllMocks();
        // On device the typeface resolves a render or two in; these assertions are
        // about what is drawn once it has.
        vi.mocked(useFont).mockReturnValue(fontStub);
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'hourly'}));
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([morning, halfPast, afternoon, laterDay]);
        vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.mocked(useFont).mockReturnValue(null);
    });

    it('labels the point folding a whole day of Records with how many it holds', async () => {
        const root = await renderScreen();

        // 1M buckets by the day, so all three of that day's Records fold into one
        // point - and it says so, while the lone Record two days later does not.
        expect(countLabels(root)).toEqual(['3']);
    });

    it('relabels to the new aggregation after a tap zooms in', async () => {
        const root = await renderScreen();

        await pressChartPoint(root);

        // The zoomed day is bucketed by the hour: the 09:00 pair stays folded
        // together and still says so, while the afternoon Record now stands alone
        // and drops its label.
        expect(lastRequestedRange()).toEqual({start: on(7, 12, 0), end: on(7, 13, 0)});
        expect(countLabels(root)).toEqual(['2']);
    });

    it('keeps a labelled point tapping exactly as it did', async () => {
        const navigate = vi.fn();
        const root = await renderScreen(navigate);

        await pressChartPoint(root);
        const atTheLimit = mockGetRecordsByTimeRangeExecute.mock.calls.length;

        // Tapping the labelled 09:00 point again: an hour inside a day is as far
        // as zoom goes, so the label is all it offers - it opens no Record and
        // narrows no further.
        await pressChartPoint(root);

        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(atTheLimit);
        expect(navigate).not.toHaveBeenCalled();
        expect(countLabels(root)).toEqual(['2']);
    });
});
