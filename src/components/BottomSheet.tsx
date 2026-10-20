import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from './theme';

/** Visible heights as fractions of the available space: peeking, half, and almost full. */
const SNAPS = [0.2, 0.55, 0.92];
const START_SNAP = 1;

/**
 * A panel pinned to the bottom of its parent that the user drags up and down by its handle.
 * It settles on the nearest snap height, taking the release velocity into account.
 */
export function BottomSheet({ children }: { children: ReactNode }) {
  const t = useTheme();
  const [space, setSpace] = useState(0);
  const height = useRef(new Animated.Value(0)).current;
  const current = useRef(0);
  const dragStart = useRef(0);
  const spaceRef = useRef(0);

  useEffect(() => {
    const id = height.addListener(({ value }) => (current.current = value));
    return () => height.removeListener(id);
  }, [height]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h === spaceRef.current) return;
    const first = spaceRef.current === 0;
    spaceRef.current = h;
    setSpace(h);
    if (first) height.setValue(h * SNAPS[START_SNAP]);
  };

  const settle = (velocityY: number) => {
    const h = spaceRef.current;
    // A fast flick carries the sheet further than where the finger let go.
    const projected = current.current - velocityY * 120;
    const target = SNAPS.map((f) => f * h).reduce((best, v) => (Math.abs(v - projected) < Math.abs(best - projected) ? v : best));
    Animated.spring(height, { toValue: target, useNativeDriver: false, bounciness: 4 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        height.stopAnimation();
        dragStart.current = current.current;
      },
      onPanResponderMove: (_, g) => {
        const h = spaceRef.current;
        height.setValue(Math.min(SNAPS[SNAPS.length - 1] * h, Math.max(SNAPS[0] * h, dragStart.current - g.dy)));
      },
      onPanResponderRelease: (_, g) => settle(g.vy),
      onPanResponderTerminate: (_, g) => settle(g.vy),
    }),
  ).current;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {space > 0 && (
        <Animated.View style={[s.sheet, { height, backgroundColor: t.bg, borderColor: t.border }]}>
          <View {...pan.panHandlers} style={[s.handleArea, Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none' } as object) : null]}>
            <View style={[s.handle, { backgroundColor: t.border }]} />
          </View>
          <View style={s.content}>{children}</View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  handle: { width: 44, height: 5, borderRadius: 3 },
  content: { flex: 1 },
});
