import { Tabs } from "expo-router/js-tabs";
import { palette } from "@/constants/design";
import { Icon } from "./directory-ui";
import FloatingTabBar from "./floating-tab-bar";

/** The web shares Android's floating bar so all three platforms match. */
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
