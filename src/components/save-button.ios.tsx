import { Button, Host } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  disabled,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import type { SaveButtonProps } from "./save-button";
export default function SaveButton({ label, busy, onPress }: SaveButtonProps) {
  return (
    <Host matchContents colorScheme="light">
      <Button
        label={busy ? "Saving…" : label}
        systemImage="checkmark"
        onPress={onPress}
        modifiers={[
          buttonStyle("borderedProminent"),
          controlSize("large"),
          tint("#b83826"),
          disabled(busy),
        ]}
      />
    </Host>
  );
}
