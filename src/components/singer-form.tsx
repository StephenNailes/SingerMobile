import { router, Stack, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  displayMaxScale,
  hitSize,
  measure,
  palette,
  radius,
  space,
  text,
  tone,
} from "@/constants/design";
import { useDirectory } from "@/data/directory-context";
import { friendlyError } from "@/data/repository";
import {
  emptySinger,
  genres,
  validateSinger,
  type FieldErrors,
  type Singer,
  type SingerInput,
} from "@/data/singers";
import { useConfirm } from "./confirm";
import { ActionButton, Eyebrow, Notice } from "./directory-ui";
import SaveButton from "./save-button";

export default function SingerForm({ singer }: { singer?: Singer }) {
  const directory = useDirectory();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const [initial] = useState<SingerInput>(
    singer
      ? {
          name: singer.name,
          genre: singer.genre,
          hometown: singer.hometown,
          song: singer.song,
          bio: singer.bio,
          imageUrl: singer.imageUrl,
          sourceUrl: singer.sourceUrl,
        }
      : { ...emptySinger },
  );
  const [input, setInput] = useState<SingerInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<number>();
  const submitted = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const fields = useRef<Partial<Record<keyof SingerInput, TextInput | null>>>(
    {},
  );
  const dirty = JSON.stringify(input) !== JSON.stringify(initial);

  usePreventRemove((dirty || busy) && savedId === undefined, ({ data }) => {
    if (busy) return;
    confirm({
      title: "Discard changes?",
      message: "Your unsaved changes to this profile will be lost.",
      action: "Discard changes",
      icon: "trash-2",
      destructive: true,
      cancelLabel: "Keep editing",
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  useEffect(() => {
    if (savedId !== undefined) {
      if (singer) router.dismissTo(`/singer/${savedId}`);
      else router.replace(`/singer/${savedId}`);
    }
  }, [savedId, singer]);

  useEffect(() => {
    if (Platform.OS !== "web" || !dirty || savedId !== undefined) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, savedId]);

  function change<K extends keyof SingerInput>(key: K, value: SingerInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setError("");
  }

  async function save() {
    if (submitted.current) return;
    const nextErrors = validateSinger(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      fields.current[Object.keys(nextErrors)[0] as keyof SingerInput]?.focus();
      return;
    }
    submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const id = singer
        ? (await directory.update(singer.id, input), singer.id)
        : await directory.create(input);
      setSavedId(id);
    } catch (cause) {
      setError(friendlyError(cause));
      scroll.current?.scrollTo({ y: 0, animated: false });
      submitted.current = false;
    } finally {
      setBusy(false);
    }
  }

  function field(
    key: Exclude<keyof SingerInput, "genre">,
    label: string,
    placeholder: string,
    multiline = false,
  ) {
    const isUrl = key === "imageUrl" || key === "sourceUrl";
    return (
      <View style={styles.field} key={key}>
        <Text style={text.subhead}>
          {label}
          {key === "name" ? " *" : ""}
        </Text>
        <TextInput
          ref={(ref) => {
            fields.current[key] = ref;
          }}
          accessibilityLabel={label}
          accessibilityHint={errors[key]}
          value={input[key]}
          onChangeText={(value) => change(key, value)}
          editable={!busy}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          autoCapitalize={isUrl ? "none" : "sentences"}
          autoCorrect={!isUrl}
          keyboardType={isUrl ? "url" : "default"}
          style={[
            text.body,
            styles.input,
            { borderColor: errors[key] ? palette.accent : palette.line },
            multiline ? styles.inputMultiline : styles.inputSingle,
          ]}
          onBlur={() =>
            setErrors((current) => ({
              ...current,
              [key]: validateSinger(input)[key],
            }))
          }
        />
        {errors[key] && (
          <Text accessibilityRole="alert" style={[text.footnote, tone.accent]}>
            {errors[key]}
          </Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={96}
    >
      <Stack.Screen
        options={{
          title: singer ? "Edit singer" : "Add singer",
          gestureEnabled: !dirty && !busy,
          headerBackButtonMenuEnabled: false,
        }}
      />
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <View style={styles.intro}>
          <Eyebrow>
            {singer ? "Make it their own" : "Make room for a new voice"}
          </Eyebrow>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={displayMaxScale}
            style={text.displayM}
          >
            {singer ? "A story, refined." : "Every voice has a story."}
          </Text>
          <Text style={[text.callout, tone.muted]}>
            {singer
              ? "Keep this singer’s profile up to date."
              : "Add a Filipino singer to your personal directory."}{" "}
            Only the name is required; a genre is preselected.
          </Text>
        </View>

        {error ? <Notice>{error}</Notice> : null}

        {field("name", "Singer name", "e.g. Regine Velasquez")}

        <View style={styles.field}>
          <Text style={text.subhead}>Primary genre</Text>
          <View style={styles.chips}>
            {genres.map((genre) => {
              const selected = input.genre === genre;
              return (
                <Pressable
                  key={genre}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Genre ${genre}`}
                  accessibilityState={{ selected, disabled: busy }}
                  onPress={() => change("genre", genre)}
                  style={({ pressed }) => [
                    styles.chip,
                    selected ? styles.chipSelected : styles.chipIdle,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[text.subhead, selected ? tone.inverse : tone.muted]}
                    maxFontSizeMultiplier={1.4}
                  >
                    {genre}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.genre && <Notice>{errors.genre}</Notice>}
        </View>

        {field("hometown", "Hometown", "e.g. Manila, Philippines")}
        {field(
          "bio",
          "About the singer",
          "Tell their story, in a few sentences.",
          true,
        )}
        {field("song", "Known for", "A signature song or performance")}

        <View style={styles.section}>
          <Text style={text.title2}>The finishing touches</Text>
          <Text style={[text.footnote, tone.muted]}>
            Optional links for a portrait and a reliable artist source.
          </Text>
        </View>

        {field("imageUrl", "Portrait URL", "https://example.com/portrait.jpg")}
        <Text style={[text.caption, styles.hint]}>
          Use an image you have permission to display. Leave blank for the
          original portrait or initials. Linked portraits need internet on first
          load.
        </Text>
        {field("sourceUrl", "Artist source URL", "https://artist-website.com")}

        <View style={styles.submit}>
          <SaveButton
            label={singer ? "Save changes" : "Create singer"}
            busy={busy}
            onPress={save}
          />
          <ActionButton
            label="Cancel"
            secondary
            busy={busy}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/directory")
            }
          />
          <Text style={[text.caption, styles.centered]}>
            Saved on this device. No account needed.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: {
    padding: space.gutter,
    gap: space.md,
    maxWidth: measure.prose,
    width: "100%",
    alignSelf: "center",
  },
  intro: { gap: space.sm, paddingBottom: space.xs },
  field: { gap: space.xs },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.group,
    color: palette.ink,
  },
  inputSingle: { minHeight: hitSize + 8, paddingVertical: space.sm },
  inputMultiline: { minHeight: 144, paddingVertical: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: {
    minHeight: hitSize,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: space.group,
  },
  chipSelected: { backgroundColor: palette.ink },
  chipIdle: { borderWidth: 1, borderColor: palette.line },
  pressed: { opacity: 0.6 },
  section: {
    gap: space.tight,
    marginTop: space.sm,
    paddingTop: space.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  hint: { marginTop: -space.xs },
  submit: { gap: space.sm, paddingTop: space.sm },
  centered: { textAlign: "center" },
});
