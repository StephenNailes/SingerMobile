import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActionSheet from "@/components/action-sheet";
import { useConfirm } from "@/components/confirm";
import {
  ActionButton,
  EmptyState,
  ExternalButton,
  Eyebrow,
  Icon,
  IconButton,
  Notice,
  Portrait,
  portraitCredits,
} from "@/components/directory-ui";
import {
  displayMaxScale,
  measure,
  palette,
  radius,
  serif,
  space,
  text,
  tone,
} from "@/constants/design";
import { useDirectory } from "@/data/directory-context";
import { friendlyError } from "@/data/repository";

export default function SingerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { singers, toggleFavorite, remove } = useDirectory();
  const singer = singers.find((item) => item.id === Number(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();

  if (!singer)
    return (
      <View style={styles.screen}>
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

  async function favorite() {
    if (busy || !singer) return;
    setBusy(true);
    setError("");
    try {
      await toggleFavorite(singer.id);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSinger() {
    if (!singer || busy) return;
    const confirmed = await confirm({
      title: `Delete ${singer.name}?`,
      message:
        "This removes the profile and its saved status from this device. This cannot be undone.",
      action: "Delete singer",
      icon: "trash-2",
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      await remove(singer.id);
      router.replace("/directory");
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }

  const credit =
    !singer.imageUrl && portraitCredits.find((p) => p.name === singer.name);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Singer profile",
          headerRight: () => (
            <IconButton
              label="More actions"
              name="more-horizontal"
              onPress={() => setMenu(true)}
            />
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <Portrait singer={singer} large />

        <View style={styles.title}>
          <Eyebrow>{singer.genre} · Filipino voice</Eyebrow>
          <Text
            selectable
            accessibilityRole="header"
            maxFontSizeMultiplier={displayMaxScale}
            style={styles.name}
          >
            {singer.name}
          </Text>
          {singer.hometown ? (
            <View style={styles.hometown}>
              <Icon name="map-pin" size={16} color={palette.muted} />
              <Text selectable style={[text.callout, tone.muted, styles.fill]}>
                {singer.hometown}
              </Text>
            </View>
          ) : null}
        </View>

        {error ? <Notice>{error}</Notice> : null}

        <View style={styles.actions}>
          <ActionButton
            label={singer.favorite ? "Saved singer" : "Save singer"}
            icon={singer.favorite ? "check" : "bookmark"}
            busy={busy}
            onPress={favorite}
          />
          <ActionButton
            label="Edit profile"
            secondary
            icon="edit-2"
            busy={busy}
            onPress={() => router.push(`/singer/${singer.id}/edit`)}
          />
        </View>

        <View style={styles.section}>
          <Text style={text.title2}>Behind the voice</Text>
          <Text selectable style={[text.body, tone.muted, styles.prose]}>
            {singer.bio ||
              "Their story is still being written. Edit this profile to add a biography."}
          </Text>
        </View>

        {singer.song ? (
          <View style={styles.callout}>
            <Icon name="music" size={19} color={palette.accent} />
            <Eyebrow>Known for</Eyebrow>
            <Text selectable style={text.title3}>
              {singer.song}
            </Text>
          </View>
        ) : null}

        {singer.sourceUrl ? (
          <ExternalButton url={singer.sourceUrl} label="Visit artist source" />
        ) : null}

        {credit && (
          <View style={styles.credit}>
            <Text style={text.caption}>
              Portrait: {credit.author} · {credit.license}. Cropped to fit.
            </Text>
            <ExternalButton url={credit.url} label="Photo source and credit" />
          </View>
        )}

        <View style={styles.meta}>
          <Text style={text.caption}>
            Last updated {new Date(singer.updatedAt).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={singer.name}
        description="Profile actions"
        actions={[
          {
            label: "Edit profile",
            icon: "edit-2",
            onPress: () => router.push(`/singer/${singer.id}/edit`),
          },
          {
            label: singer.favorite ? "Remove from saved" : "Save singer",
            icon: "bookmark",
            onPress: favorite,
          },
          {
            label: "Delete singer",
            detail: "Removes this profile from this device",
            icon: "trash-2",
            destructive: true,
            onPress: deleteSinger,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: {
    padding: space.gutter,
    gap: space.gutter,
    maxWidth: measure.profile,
    width: "100%",
    alignSelf: "center",
  },
  title: { gap: space.sm },
  name: {
    fontFamily: serif,
    fontSize: 40,
    lineHeight: 45,
    letterSpacing: -1.2,
    color: palette.ink,
  },
  hometown: { flexDirection: "row", alignItems: "center", gap: space.tight },
  fill: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  section: {
    gap: space.sm,
    paddingTop: space.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  prose: { maxWidth: 620 },
  callout: {
    backgroundColor: palette.soft,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.xs,
  },
  credit: { gap: space.xs },
  meta: {
    paddingTop: space.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
});
