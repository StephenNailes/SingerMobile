import { Platform, type TextStyle } from "react-native";

/**
 * One place for the app's visual language: colour, type scale and spacing
 * rhythm. Screens should read from here instead of inventing font sizes or
 * one-off padding so the whole directory stays on the same grid.
 */

export const palette = {
  paper: "#faf7f2",
  ink: "#242420",
  muted: "#706c65",
  accent: "#b83826",
  line: "#e5dfd6",
  soft: "#efeae2",
  danger: "#9c2a1b",
  scrim: "rgba(28, 24, 20, 0.42)",
};

/** Editorial serif used for display headings only. */
export const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});

/**
 * 4pt spacing rhythm. `gutter` is the screen edge, `section` separates major
 * blocks, `group` separates related blocks, `tight` separates a label from the
 * thing it labels.
 */
export const space = {
  hair: 2,
  tight: 6,
  xs: 8,
  sm: 12,
  group: 16,
  md: 20,
  gutter: 24,
  section: 32,
  xl: 40,
  xxl: 56,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Minimum tappable side, per Apple HIG. */
export const hitSize = 44;

/**
 * Type scale. Display sizes are serif and set tight; everything from `title1`
 * down is the system sans at text-friendly line heights (~1.3 for headings,
 * ~1.5 for body copy). Letter spacing is optical: negative as size grows,
 * positive only for uppercase.
 */
export const text = {
  displayXL: {
    fontFamily: serif,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.4,
    color: palette.ink,
  },
  displayL: {
    fontFamily: serif,
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -1.1,
    color: palette.ink,
  },
  displayM: {
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  title1: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: palette.ink,
  },
  title2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: palette.ink,
  },
  title3: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: palette.ink,
  },
  headline: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: palette.ink,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: palette.ink,
  },
  callout: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    color: palette.ink,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: palette.ink,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "400",
    color: palette.muted,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
    color: palette.muted,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: palette.accent,
  },
} satisfies Record<string, TextStyle>;

/** Colour overrides, applied as `style={[text.body, tone.muted]}`. */
export const tone = {
  ink: { color: palette.ink },
  muted: { color: palette.muted },
  accent: { color: palette.accent },
  inverse: { color: "#ffffff" },
} satisfies Record<string, TextStyle>;

/**
 * Display type is already large, so let it grow less than body copy under
 * Dynamic Type; body copy stays uncapped for accessibility.
 */
export const displayMaxScale = 1.35;
export const headingMaxScale = 1.6;

/** Fluid display size: one step down on narrow phones. */
export function displayStyle(width: number) {
  return width < 380 ? text.displayM : text.displayL;
}

/**
 * The Android and web tab bar floats over the content like the iOS 26 one, so
 * scrollable tab screens have to leave room for it themselves. iOS native tabs
 * apply their own content insets.
 */
export const floatingTabBar = { height: 64, inset: 12 } as const;
export const tabBarClearance =
  Platform.OS === "ios" ? 0 : floatingTabBar.height + floatingTabBar.inset * 2;

/** Content column widths, so long-form text never runs the full tablet width. */
export const measure = {
  prose: 680,
  profile: 720,
  grid: 1060,
} as const;

/** Horizontal screen padding. */
export function gutterFor(width: number) {
  return width < 380 ? space.md : space.gutter;
}
