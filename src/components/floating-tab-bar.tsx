import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  floatingTabBar,
  palette,
  radius,
  space,
  text,
} from "@/constants/design";

/**
 * A floating tab bar that mirrors the iOS 26 tab bar: a rounded, detached pill
 * that hovers over the content instead of sitting flush against the bottom
 * edge. Used on Android and the web, where the platform tab bar is a flat
 * attached strip.
 */
export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.dock,
        { paddingBottom: insets.bottom + floatingTabBar.inset },
      ]}
    >
      <View accessibilityRole="tablist" style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.title === "string" ? options.title : route.name;
          const color = focused ? palette.accent : palette.muted;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              }}
              style={({ pressed }) => [
                styles.tab,
                focused && styles.tabSelected,
                pressed && styles.pressed,
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 21 })}
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
                style={[
                  text.caption,
                  styles.label,
                  { color, fontWeight: focused ? "700" : "500" },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: space.group,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 440,
    height: floatingTabBar.height,
    paddingHorizontal: space.tight,
    borderRadius: radius.pill,
    backgroundColor: palette.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    ...Platform.select({
      android: { elevation: 10 },
      default: {
        shadowColor: "#2b241c",
        shadowOpacity: 0.16,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  tab: {
    flex: 1,
    height: floatingTabBar.height - space.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radius.pill,
  },
  tabSelected: { backgroundColor: palette.soft },
  pressed: { opacity: 0.6 },
  label: { letterSpacing: 0.1 },
});
