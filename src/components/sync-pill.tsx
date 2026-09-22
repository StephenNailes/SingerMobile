import type Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, radius, space, text } from "@/constants/design";
import { useDirectory } from "@/data/directory-context";
import { Icon } from "./directory-ui";

type Feel = "quiet" | "warn";

/**
 * One line telling the reader where the directory stands: offline, catching
 * up, or holding writes the server refused. Silent when everything is in sync,
 * which is most of the time. Tapping it tries the server again.
 */
export default function SyncPill() {
  const { status, refresh } = useDirectory();
  if (!status) return null; // Device-only directory: nothing to sync.

  const waiting = status.pending;
  let message: string | null = null;
  let icon: ComponentProps<typeof Feather>["name"] = "cloud-off";
  let feel: Feel = "quiet";

  if (status.rejected.length > 0) {
    message = status.rejected[status.rejected.length - 1];
    icon = "alert-circle";
    feel = "warn";
  } else if (status.syncing && waiting > 0) {
    message = `Saving ${waiting} change${waiting === 1 ? "" : "s"}…`;
  } else if (status.syncing) {
    message = "Updating the directory…";
  } else if (!status.online && waiting > 0) {
    message = `Offline · ${waiting} change${waiting === 1 ? "" : "s"} will sync when you’re back`;
    feel = "warn";
  } else if (!status.online) {
    message = "Offline · showing your saved copy";
  } else if (waiting > 0) {
    message = `${waiting} change${waiting === 1 ? "" : "s"} waiting to sync`;
  }

  if (!message) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${message}. Tap to try again.`}
      onPress={() => {
        refresh().catch(() => {});
      }}
      style={({ pressed }) => [
        styles.pill,
        feel === "warn" && styles.warn,
        pressed && styles.pressed,
      ]}
    >
      {status.syncing ? (
        <ActivityIndicator size="small" color={palette.muted} />
      ) : (
        <Icon
          name={icon}
          size={15}
          color={feel === "warn" ? palette.accent : palette.muted}
        />
      )}
      <View style={styles.label}>
        <Text
          style={[
            text.footnote,
            { color: feel === "warn" ? palette.accent : palette.muted },
          ]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    alignSelf: "flex-start",
    paddingVertical: space.tight,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.soft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    marginTop: space.sm,
  },
  warn: { borderColor: palette.accent },
  pressed: { opacity: 0.6 },
  label: { flexShrink: 1 },
});
