import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, View} from 'react-native';
import {FooterBar, useFooterClearance} from './FooterBar';

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    return RN;
});

// Overrides the global mock from `vitest.setup.ts`, whose insets are fixed at zero.
const {mockInsets} = vi.hoisted(() => ({
    mockInsets: {value: {top: 0, left: 0, right: 0, bottom: 0}},
}));

vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => mockInsets.value,
}));

const GESTURE_PILL = 24;
const THREE_BUTTONS = 48;
const NO_SYSTEM_CHROME = 0;

/** The bar's own spacing, which the system inset is added to rather than replacing. */
const BAR_PADDING = 16;

/** What the bar carries above that padding: its action, the matching padding over it, and the top hairline. */
const BAR_ABOVE_ITS_PADDING = 56 + BAR_PADDING + 1;

function deviceWithNavigationBar(bottom: number) {
    mockInsets.value = {top: 0, left: 0, right: 0, bottom};
}

function renderBar() {
    let root: any;
    act(() => {
        root = renderer.create(<FooterBar><View testID="action"/></FooterBar>);
    });
    return root!;
}

/** The bar itself is the outermost View it renders. */
function barPaddingBottom(root: any): number {
    return StyleSheet.flatten(root.root.findAllByType(View)[0].props.style).paddingBottom;
}

function clearance(): number {
    let value = 0;

    function Probe() {
        value = useFooterClearance();
        return null;
    }

    act(() => {
        renderer.create(<Probe/>);
    });
    return value;
}

describe('FooterBar', () => {
    beforeEach(() => {
        deviceWithNavigationBar(NO_SYSTEM_CHROME);
    });

    it('pads below its action for the system navigation bar it is drawn under', () => {
        deviceWithNavigationBar(THREE_BUTTONS);

        expect(barPaddingBottom(renderBar())).toBe(BAR_PADDING + THREE_BUTTONS);
    });

    it('keeps only its own spacing where there is no system chrome below it', () => {
        expect(barPaddingBottom(renderBar())).toBe(BAR_PADDING);
    });

    it('pads by the inset the device reports rather than one figure for every device', () => {
        deviceWithNavigationBar(GESTURE_PILL);
        const onGesturePill = barPaddingBottom(renderBar());

        deviceWithNavigationBar(THREE_BUTTONS);

        expect(barPaddingBottom(renderBar()) - onGesturePill).toBe(THREE_BUTTONS - GESTURE_PILL);
    });
});

describe('useFooterClearance', () => {
    beforeEach(() => {
        deviceWithNavigationBar(NO_SYSTEM_CHROME);
    });

    it('reserves the whole bar, so content ending at the reserved edge clears its action', () => {
        deviceWithNavigationBar(THREE_BUTTONS);
        const root = renderBar();

        expect(clearance()).toBeGreaterThanOrEqual(barPaddingBottom(root) + BAR_ABOVE_ITS_PADDING);
    });

    it('grows with the system inset, which the bar it has to clear also grows by', () => {
        deviceWithNavigationBar(GESTURE_PILL);
        const onGesturePill = clearance();

        deviceWithNavigationBar(THREE_BUTTONS);

        expect(clearance() - onGesturePill).toBe(THREE_BUTTONS - GESTURE_PILL);
    });
});
