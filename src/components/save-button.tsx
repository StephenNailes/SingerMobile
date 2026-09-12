import { ActionButton } from "./directory-ui";
export type SaveButtonProps = {
  label: string;
  busy: boolean;
  onPress: () => void;
};
export default function SaveButton(props: SaveButtonProps) {
  return <ActionButton {...props} icon="check" />;
}
