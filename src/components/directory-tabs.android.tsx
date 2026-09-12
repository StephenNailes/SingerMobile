import { Tabs } from "expo-router/js-tabs";
import { palette } from "@/constants/design";
import { Icon } from "./directory-ui";
import FloatingTabBar from "./floating-tab-bar";

/**
 * Android uses the JS tab navigator with a custom floating bar so the
 * navigation reads the same as the detached iOS 26 tab bar, instead of the
 * flat Material strip pinned to the bottom edge.
 */
export default function DirectoryTabs() {
  return (
    <Tabs
      initialRouteName="directory"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.paper },
      }}
    >
      <Tabs.Screen
        name="directory"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => <Icon name="grid" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => <Icon name="bookmark" color={color} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: "About",
          tabBarIcon: ({ color }) => <Icon name="info" color={color} />,
        }}
      />
    </Tabs>
  );
}
