import { NativeTabs } from "expo-router/unstable-native-tabs";
import { palette } from "@/constants/design";

/**
 * iOS keeps the platform tab bar, which already floats on iOS 26 and minimises
 * as the directory scrolls. Android and the web get a matching floating bar
 * from `directory-tabs.android.tsx` / `directory-tabs.web.tsx`.
 */
export default function DirectoryTabs() {
  return (
    <NativeTabs
      tintColor={palette.accent}
      backgroundColor={palette.paper}
      minimizeBehavior="onScrollDown"
      labelStyle={{ fontSize: 11, fontWeight: "600" }}
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="directory">
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bookmark" md="bookmark_border" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="about">
        <NativeTabs.Trigger.Label>About</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="info.circle" md="info" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
