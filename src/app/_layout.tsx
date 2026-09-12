import "@/global.css";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConfirmProvider } from "@/components/confirm";
import { palette, text } from "@/constants/design";
import { DirectoryProvider } from "@/data/directory-context";

export const unstable_settings = { initialRouteName: "(tabs)" };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider
        value={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            primary: palette.accent,
            background: palette.paper,
            card: palette.paper,
            text: palette.ink,
            border: palette.line,
          },
        }}
      >
        <StatusBar style="dark" />
        <DirectoryProvider>
          <ConfirmProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: palette.paper },
                headerTintColor: palette.ink,
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: text.title3.fontSize,
                  fontWeight: text.title3.fontWeight,
                },
                contentStyle: { backgroundColor: palette.paper },
                headerBackTitle: "Back",
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="explore" options={{ headerShown: false }} />
              <Stack.Screen
                name="singer/new"
                options={{ title: "Add singer" }}
              />
              <Stack.Screen
                name="singer/[id]/index"
                options={{ title: "Singer profile" }}
              />
              <Stack.Screen
                name="singer/[id]/edit"
                options={{ title: "Edit singer" }}
              />
            </Stack>
          </ConfirmProvider>
        </DirectoryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
