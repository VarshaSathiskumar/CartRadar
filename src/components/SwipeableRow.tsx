import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from './theme';

/** A drag past this share of the row's width counts as a swipe; capped so wide rows stay easy to swipe. */
const THRESHOLD_SHARE = 0.35;
const MAX_THRESHOLD_PX = 120;

/**
 * True while a drag is in progress and for a moment after it ends. On the web the mouse-up that finishes a drag also
 * fires a click on the row's own button, so a button inside a SwipeableRow should ignore presses while this is set.
 */
const DragGuard = createContext<{ current: boolean }>({ current: false });
export const useJustDragged = () => useContext(DragGuard);

/**
 * Lets a row be dragged to the left to reveal an action, and commits the action when dragged far enough.
 * Vertical scrolling is left alone: only a mostly horizontal leftward drag claims the gesture.
 */
export function SwipeableRow({
  children,
  label,
  onSwipeLeft,
}: {
  children: ReactNode;
  /** Shown behind the row while it is dragged, e.g. "Move to cart". */
  label: string;
  onSwipeLeft: () => void;
}) {
  const t = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const dragged = useRef(false);
  const endDrag = () => setTimeout(() => (dragged.current = false), 150);
  const onSwipe = useRef(onSwipeLeft);
  onSwipe.current = onSwipeLeft;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => (dragged.current = true),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, Math.max(-widthRef.current, g.dx))),
      onPanResponderRelease: (_, g) => {
        endDrag();
        const w = widthRef.current;
        if (g.dx < -Math.min(MAX_THRESHOLD_PX, w * THRESHOLD_SHARE)) {
          Animated.timing(x, { toValue: -w, duration: 160, useNativeDriver: false }).start(() => {
            onSwipe.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        endDrag();
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      },
    }),
  ).current;

  const labelOpacity = x.interpolate({ inputRange: [-80, -20, 0], outputRange: [1, 0.4, 0], extrapolate: 'clamp' });

  return (
    <View style={s.wrap} onLayout={onLayout}>
      <View style={[s.action, { backgroundColor: t.accent }]}>
        <Animated.Text style={[s.actionText, { color: t.accentText, opacity: labelOpacity }]}>{label}</Animated.Text>
      </View>
      <Animated.View
        {...pan.panHandlers}
        accessibilityActions={[{ name: 'swipeLeft', label }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'swipeLeft' && onSwipe.current()}
        style={[{ transform: [{ translateX: x }], opacity: width === 0 ? 0 : 1 }, Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as object) : null]}
      >
        <DragGuard.Provider value={dragged}>{children}</DragGuard.Provider>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 10 },
  action: { ...(StyleSheet.absoluteFill as object), borderRadius: 14, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 18 },
  actionText: { fontWeight: '800', fontSize: 15 },
});
