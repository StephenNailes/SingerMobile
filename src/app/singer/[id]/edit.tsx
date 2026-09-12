import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { ActionButton, EmptyState } from "@/components/directory-ui";
import SingerForm from "@/components/singer-form";
import { useDirectory } from "@/data/directory-context";
export default function EditSinger() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { singers } = useDirectory();
  const singer = singers.find((item) => item.id === Number(id));
  if (!singer)
    return (
      <View className="flex-1 bg-paper">
        <EmptyState
          title="Singer not found"
          description="This profile may have been deleted."
          action={
            <ActionButton
              label="Back to directory"
              onPress={() => router.replace("/directory")}
            />
          }
        />
      </View>
    );
  return <SingerForm singer={singer} />;
}
