import {Platform} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

/**
 * System chrome below `bottom: 0` that a screen's floating elements have to
 * clear themselves - on Android the navigation bar, which the app renders
 * edge-to-edge underneath.
 *
 * Zero on iOS: React Native's `SafeAreaView`, which `ScreenContainer` wraps
 * every screen in, already insets there, so `bottom: 0` sits above the home
 * indicator and counting the inset again would double it. That component does
 * nothing on any other platform.
 */
export function useBottomInset(): number {
    const {bottom} = useSafeAreaInsets();

    return Platform.OS === 'ios' ? 0 : bottom;
}
