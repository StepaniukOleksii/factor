import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {EventListScreen} from './EventListScreen';
import {Event} from '../../domain/Event';
import {formatRelativeTime} from '@shared/formatRelativeTime';

const {mockGetEventsExecute} = vi.hoisted(() => ({
    mockGetEventsExecute: vi.fn(),
}));

/** The screen's focus callbacks, so a test can send it back to the screen. */
const {focusListeners} = vi.hoisted(() => ({
    focusListeners: new Set<() => void>(),
}));

vi.mock('react-native', () => require('react-native-web'));
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

vi.mock('@react-navigation/native', () => {
    const React = require('react');
    return {
        useFocusEffect: (callback: React.EffectCallback) => {
            const [focusCount, setFocusCount] = React.useState(0);
            React.useEffect(() => {
                const onFocus = () => setFocusCount((count: number) => count + 1);
                focusListeners.add(onFocus);
                return () => focusListeners.delete(onFocus);
            }, []);
            React.useEffect(() => callback(), [callback, focusCount]);
        },
    };
});

vi.mock('../../infrastructure/SQLiteEventRepository', () => ({
    SQLiteEventRepository: vi.fn(),
}));
vi.mock('../../application/GetEventsUseCase', () => ({
    GetEventsUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetEventsExecute,
    })),
}));

const described = new Event('e1', 'today', new Date(2026, 8, 9, 9, 0), 'What the first Event was about.');
const plain = new Event('e2', 'this week', new Date(2026, 8, 6, 9, 0));
const otherDescribed = new Event('e3', 'repeated', new Date(2026, 0, 12, 9, 0), 'The older of the two.');

function page(events: Event[], hasMore = false) {
    return {events, hasMore};
}

function eventsNumbering(count: number): Event[] {
    return Array.from({length: count}, (_, index) =>
        new Event(`bulk-${index}`, `Event ${index}`, new Date(2026, 8, 9, 9, 0)));
}

async function renderScreen() {
    let root: any;
    await act(async () => {
        root = renderer.create(<EventListScreen/>);
    });
    return root!;
}

function textNodes(root: any, text: string) {
    return root.findAll((node: any) => node.children && node.children.length === 1 && node.children[0] === text);
}

/** The pressable a tile is wrapped in, found through the name it shows. */
function tileFor(root: any, name: string) {
    let current = textNodes(root, name)[0]?.parent;
    while (current) {
        if (current.props && typeof current.props.onPress === 'function') return current;
        current = current.parent;
    }
    return null;
}

async function press(node: any) {
    await act(async () => {
        node.props.onPress();
    });
}

describe('EventListScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        focusListeners.clear();
        mockGetEventsExecute.mockResolvedValue(page([]));
    });

    it('renders a tile per Event, carrying its name and when it occurred', async () => {
        mockGetEventsExecute.mockResolvedValue(page([described, plain]));

        const root = await renderScreen();

        expect(textNodes(root.root, 'today')).toHaveLength(1);
        expect(textNodes(root.root, 'this week')).toHaveLength(1);
        expect(textNodes(root.root, formatRelativeTime(described.occurredAt))).toHaveLength(1);
        expect(textNodes(root.root, formatRelativeTime(plain.occurredAt))).toHaveLength(1);
    });

    it('keeps a description off the tile until it is opened', async () => {
        mockGetEventsExecute.mockResolvedValue(page([described]));

        const root = await renderScreen();

        expect(textNodes(root.root, described.description!)).toHaveLength(0);
    });

    it('opens a described Event on press and closes it on a second press', async () => {
        mockGetEventsExecute.mockResolvedValue(page([described]));
        const root = await renderScreen();

        await press(tileFor(root.root, 'today'));
        expect(textNodes(root.root, described.description!)).toHaveLength(1);

        await press(tileFor(root.root, 'today'));
        expect(textNodes(root.root, described.description!)).toHaveLength(0);
    });

    it('closes the open tile when another is opened', async () => {
        mockGetEventsExecute.mockResolvedValue(page([described, otherDescribed]));
        const root = await renderScreen();

        await press(tileFor(root.root, 'today'));
        await press(tileFor(root.root, 'repeated'));

        expect(textNodes(root.root, described.description!)).toHaveLength(0);
        expect(textNodes(root.root, otherDescribed.description!)).toHaveLength(1);
    });

    it('swaps the chevron for the open state', async () => {
        mockGetEventsExecute.mockResolvedValue(page([described]));
        const root = await renderScreen();

        expect(root.root.findAllByProps({name: 'expand-more'}).length).toBeGreaterThan(0);

        await press(tileFor(root.root, 'today'));

        expect(root.root.findAllByProps({name: 'expand-less'}).length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({name: 'expand-more'})).toHaveLength(0);
    });

    it('leaves an Event without a description unpressable and chevron-less', async () => {
        mockGetEventsExecute.mockResolvedValue(page([plain]));

        const root = await renderScreen();

        expect(tileFor(root.root, 'this week').props.disabled).toBe(true);
        expect(root.root.findAllByProps({name: 'expand-more'})).toHaveLength(0);
        expect(root.root.findAllByProps({name: 'expand-less'})).toHaveLength(0);
    });

    it('reads No events yet. when nothing is stored', async () => {
        const root = await renderScreen();

        expect(textNodes(root.root, 'No events yet.')).toHaveLength(1);
    });

    it('reads No events yet. when the read fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockGetEventsExecute.mockRejectedValue(new Error('database gone'));

        const root = await renderScreen();

        expect(textNodes(root.root, 'No events yet.')).toHaveLength(1);
    });

    it('holds the screen with a spinner while it first reads', async () => {
        mockGetEventsExecute.mockReturnValue(new Promise(() => undefined));

        const root = await renderScreen();

        expect(root.root.findAllByProps({size: 'large'}).length).toBeGreaterThan(0);
        expect(textNodes(root.root, 'No events yet.')).toHaveLength(0);
    });

    it('asks for a page of twenty to begin with', async () => {
        await renderScreen();

        expect(mockGetEventsExecute).toHaveBeenCalledWith(20);
    });

    it('draws Load more only while more Events remain', async () => {
        mockGetEventsExecute.mockResolvedValue(page([described]));
        const withoutMore = await renderScreen();
        expect(textNodes(withoutMore.root, 'Load more')).toHaveLength(0);

        mockGetEventsExecute.mockResolvedValue(page(eventsNumbering(20), true));
        const withMore = await renderScreen();
        expect(textNodes(withMore.root, 'Load more')).toHaveLength(1);
    });

    it('asks for another twenty when Load more is pressed', async () => {
        mockGetEventsExecute.mockResolvedValue(page(eventsNumbering(20), true));
        const root = await renderScreen();

        await press(tileFor(root.root, 'Load more'));

        expect(mockGetEventsExecute).toHaveBeenLastCalledWith(40);
    });

    it('re-reads on focus, keeping the Events already loaded', async () => {
        mockGetEventsExecute.mockResolvedValue(page(eventsNumbering(20), true));
        const root = await renderScreen();
        await press(tileFor(root.root, 'Load more'));

        await act(async () => {
            focusListeners.forEach(listener => listener());
        });

        expect(mockGetEventsExecute).toHaveBeenLastCalledWith(40);
        expect(mockGetEventsExecute).toHaveBeenCalledTimes(3);
    });
});
