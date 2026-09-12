import type Feather from "@expo/vector-icons/Feather";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { palette, radius, space, text, tone } from "@/constants/design";
import { ActionButton, Icon } from "./directory-ui";
import Sheet from "./sheet";

/**
 * Confirmation for a destructive or irreversible action, presented as a sheet
 * rather than a centred alert. The HIG reserves alerts for situations the
 * person did not cause; a delete they just asked for belongs in a sheet that
 * rises from the control they tapped and can be swiped away.
 */

export type ConfirmOptions = {
  title: string;
  message: string;
  /** Label for the confirming button, e.g. "Delete singer". */
  action: string;
  icon?: ComponentProps<typeof Feather>["name"];
  destructive?: boolean;
  cancelLabel?: string;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used inside a ConfirmProvider.");
  }
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolve = useRef<(answer: boolean) => void>(undefined);

  const confirm = useCallback<Confirm>((options) => {
    return new Promise<boolean>((settle) => {
      // A second request supersedes a pending one rather than stacking sheets.
      resolve.current?.(false);
      resolve.current = settle;
      setRequest(options);
      setOpen(true);
    });
  }, []);

  const answer = useCallback((value: boolean) => {
    setOpen(false);
    const settle = resolve.current;
    resolve.current = undefined;
    settle?.(value);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        visible={open}
        onClose={() => answer(false)}
        title={request?.title}
      >
        {request ? (
          <View style={styles.body}>
            <View style={styles.message}>
              <View style={styles.badge}>
                <Icon
                  name={request.icon ?? "alert-triangle"}
                  size={19}
                  color={palette.accent}
                />
              </View>
              <Text style={[text.callout, tone.muted, styles.copy]}>
                {request.message}
              </Text>
            </View>
            <View style={styles.buttons}>
              <ActionButton
                label={request.action}
                icon={request.icon}
                danger={request.destructive !== false}
                onPress={() => answer(true)}
              />
              <ActionButton
                secondary
                label={request.cancelLabel ?? "Cancel"}
                onPress={() => answer(false)}
              />
            </View>
          </View>
        ) : null}
      </Sheet>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.gutter },
  message: { flexDirection: "row", gap: space.sm },
  badge: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, paddingTop: space.tight },
  buttons: { gap: space.sm },
});
