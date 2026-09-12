import type Feather from "@expo/vector-icons/Feather";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { hitSize, palette, radius, space, text, tone } from "@/constants/design";
import { Icon } from "./directory-ui";
import Sheet from "./sheet";

/**
 * A short list of contextual choices in a sheet. This is the HIG action sheet:
 * it belongs to the thing the person just tapped, it stays brief, and the
 * destructive choice is the one tinted red.
 */

export type SheetAction = {
  label: string;
  detail?: string;
  icon?: ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
};

export default function ActionSheet({
  visible,
  onClose,
  title,
  description,
  actions,
  cancelLabel = "Cancel",
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actions: SheetAction[];
  cancelLabel?: string;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      description={description}
    >
      <View style={styles.list}>
        {actions.map((action, index) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.detail}
            accessibilityState={{ selected: action.selected }}
            onPress={() => {
              onClose();
              // Let this sheet finish leaving before the action runs, so an
              // action that opens a sheet of its own never stacks two of them.
              setTimeout(action.onPress, 260);
            }}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.divided,
              pressed && styles.pressed,
            ]}
          >
            {action.icon ? (
              <Icon
                name={action.icon}
                size={20}
                color={action.destructive ? palette.accent : palette.ink}
              />
            ) : null}
            <View style={styles.rowText}>
              <Text
                style={[text.body, action.destructive ? tone.accent : tone.ink]}
              >
                {action.label}
              </Text>
              {action.detail ? (
                <Text style={[text.footnote, tone.muted]}>{action.detail}</Text>
              ) : null}
            </View>
            {action.selected ? (
              <Icon name="check" size={19} color={palette.accent} />
            ) : null}
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        onPress={onClose}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <Text style={[text.headline, tone.ink]}>{cancelLabel}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: "#ffffff",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    overflow: "hidden",
  },
  row: {
    minHeight: hitSize + 12,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  rowText: { flex: 1, gap: 2 },
  pressed: { backgroundColor: palette.soft },
  cancel: {
    marginTop: space.sm,
    minHeight: hitSize + 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: palette.soft,
  },
});
