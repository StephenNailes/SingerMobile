import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radius, space, text, tone } from "@/constants/design";

/**
 * An iOS-style sheet: it slides up from the bottom over a dimmed backdrop,
 * shows a drag indicator, rests at one or more detents and dismisses on a
 * swipe down, a backdrop tap, or the Android back gesture.
 *
 * Per the Human Interface Guidelines, use a sheet for a focused, non-immersive
 * task or a short set of contextual choices - not for content the person needs
 * to keep referring to, and not as a general replacement for a screen.
 */

export type Detent = "fit" | "medium" | "large";

const DETENT_FRACTION: Record<Exclude<Detent, "fit">, number> = {
  medium: 0.52,
  large: 0.94,
};

/** How far past the smallest detent a drag has to land before it dismisses. */
const DISMISS_SLOP = 88;
/** Velocity is projected forward so a quick flick dismisses a tall sheet. */
const VELOCITY_PROJECTION = 90;
/** Movement, in points, before a touch counts as a drag rather than a tap. */
const DRAG_THRESHOLD = 6;

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Shown under the drag indicator and announced as the sheet's header. */
  title?: string;
  description?: string;
  /** Resting heights, smallest first. Defaults to hugging the content. */
  detents?: Detent[];
  /** Set when the sheet owns a scroll view, so dragging is limited to the handle. */
  scrollable?: boolean;
  children: ReactNode;
};

export default function Sheet({
  visible,
  onClose,
  title,
  description,
  detents = ["fit"],
  scrollable = false,
  children,
}: SheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [measured, setMeasured] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [translateY] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  /** Where the sheet is settled, in points below its tallest detent. */
  const restY = useRef(0);
  const wasVisible = useRef(visible);
  /** Touch bookkeeping for the drag: start point, and the last sample. */
  const drag = useRef({ y: 0, x: 0, lastY: 0, lastAt: 0 });

  const fits = detents[0] === "fit";
  // Never let a sheet cover the status bar; iOS leaves a sliver of the page.
  const ceiling = Math.max(windowHeight - insets.top - space.sm, 240);

  const detentKey = detents.join(",");
  const stops = useMemo(() => {
    const list = detentKey.split(",") as Detent[];
    if (list[0] === "fit")
      return measured > 0 ? [Math.min(measured, ceiling)] : [];
    return list
      .filter((detent): detent is Exclude<Detent, "fit"> => detent !== "fit")
      .map((detent) =>
        Math.round(Math.min(windowHeight * DETENT_FRACTION[detent], ceiling)),
      )
      .sort((a, b) => a - b);
  }, [ceiling, detentKey, measured, windowHeight]);

  const sheetHeight = stops.length ? stops[stops.length - 1] : 0;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  const settle = useCallback(
    (toValue: number) => {
      restY.current = toValue;
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        damping: reduceMotion ? 40 : 26,
        stiffness: reduceMotion ? 400 : 260,
        mass: 0.9,
        overshootClamping: true,
      }).start();
    },
    [reduceMotion, translateY],
  );

  const animateOut = useCallback(
    (unmount = true) => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: windowHeight,
          duration: reduceMotion ? 120 : 240,
          easing: Easing.bezier(0.32, 0.72, 0, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: reduceMotion ? 120 : 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && unmount) setMounted(false);
      });
    },
    [fade, reduceMotion, translateY, windowHeight],
  );

  // The sheet is controlled: asking to close only reports the intent, and the
  // exit animation runs once the owner actually flips `visible`.
  const dismiss = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      wasVisible.current = true;
      // Park the sheet off-screen, then mount it so it can measure itself; the
      // detent effect below slides it up once a height is known.
      translateY.setValue(windowHeight);
      fade.setValue(0);
      const frame = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(frame);
    }
    if (!visible && wasVisible.current) {
      wasVisible.current = false;
      animateOut();
    }
  }, [animateOut, fade, translateY, visible, windowHeight]);

  useEffect(() => {
    if (!visible || !sheetHeight) return;
    const target = sheetHeight - stops[0];
    restY.current = target;
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: target,
        useNativeDriver: true,
        damping: reduceMotion ? 40 : 24,
        stiffness: reduceMotion ? 400 : 240,
        mass: 0.9,
        overshootClamping: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: reduceMotion ? 120 : 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, reduceMotion, sheetHeight, stops, translateY, visible]);

  const snap = useCallback(
    (dy: number, velocity: number) => {
      if (!sheetHeight) return;
      const projected = restY.current + dy + velocity * VELOCITY_PROJECTION;
      const lowest = sheetHeight - stops[0];
      if (projected > lowest + Math.min(DISMISS_SLOP, stops[0] * 0.3)) {
        // Carry the swipe straight through to the exit so the sheet never
        // stalls under the finger while the owner re-renders.
        animateOut(false);
        dismiss();
        return;
      }
      const targets = stops.map((stop) => sheetHeight - stop);
      const nearest = targets.reduce((best, target) =>
        Math.abs(target - projected) < Math.abs(best - projected)
          ? target
          : best,
      );
      settle(nearest);
    },
    [animateOut, dismiss, settle, sheetHeight, stops],
  );

  // Capture-phase handlers, so a drag that starts on a button inside the sheet
  // still moves the sheet and cancels the button.
  const onTouchStartCapture = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    drag.current = { x: pageX, y: pageY, lastY: pageY, lastAt: Date.now() };
    return false;
  }, []);

  const onDragShouldStart = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const dy = pageY - drag.current.y;
    return (
      Math.abs(dy) > DRAG_THRESHOLD &&
      Math.abs(dy) > Math.abs(pageX - drag.current.x) * 1.5
    );
  }, []);

  const onDragMove = useCallback(
    (event: GestureResponderEvent) => {
      const { pageY } = event.nativeEvent;
      const next = restY.current + (pageY - drag.current.y);
      // Resist dragging above the tallest detent instead of letting it fly.
      translateY.setValue(next < 0 ? next * 0.3 : next);
      const now = Date.now();
      if (now - drag.current.lastAt > 16) {
        drag.current.lastY = pageY;
        drag.current.lastAt = now;
      }
    },
    [translateY],
  );

  const onDragEnd = useCallback(
    (event: GestureResponderEvent) => {
      const { pageY } = event.nativeEvent;
      const elapsed = Math.max(Date.now() - drag.current.lastAt, 1);
      snap(pageY - drag.current.y, (pageY - drag.current.lastY) / elapsed);
    },
    [snap],
  );

  const dragHandlers = {
    onStartShouldSetResponderCapture: onTouchStartCapture,
    onMoveShouldSetResponderCapture: onDragShouldStart,
    onResponderGrant: () => translateY.stopAnimation(),
    onResponderMove: onDragMove,
    onResponderRelease: onDragEnd,
    onResponderTerminate: onDragEnd,
    onResponderTerminationRequest: () => false,
  };

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: fade }]}>
          <Pressable
            style={styles.scrimTarget}
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={dismiss}
          />
        </Animated.View>
        <Animated.View
          aria-modal
          accessibilityViewIsModal
          onLayout={(event) => {
            if (fits) setMeasured(Math.ceil(event.nativeEvent.layout.height));
          }}
          style={[
            styles.sheet,
            fits ? { maxHeight: ceiling } : { height: sheetHeight },
            {
              paddingBottom: insets.bottom + space.gutter,
              transform: [{ translateY }],
            },
          ]}
          {...(scrollable ? {} : dragHandlers)}
        >
          <View
            style={styles.handleArea}
            {...(scrollable ? dragHandlers : {})}
          >
            <View style={styles.grabber} accessible={false} aria-hidden />
            {title ? (
              <View style={styles.heading}>
                <Text
                  accessibilityRole="header"
                  style={text.title2}
                  maxFontSizeMultiplier={1.6}
                >
                  {title}
                </Text>
                {description ? (
                  <Text style={[text.footnote, tone.muted]}>{description}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.scrim,
  },
  scrimTarget: { flex: 1 },
  sheet: {
    backgroundColor: palette.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.gutter,
    // A drag across the sheet should move it, not select the text under it.
    userSelect: "none",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -6 },
      },
      android: { elevation: 24 },
      default: {},
    }),
  },
  handleArea: { paddingTop: space.sm, paddingBottom: space.group },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
  },
  heading: { paddingTop: space.group, gap: space.tight },
});
