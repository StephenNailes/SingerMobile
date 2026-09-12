import { router } from "expo-router";
import { useDeferredValue, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  displayMaxScale,
  displayStyle,
  gutterFor,
  hitSize,
  measure,
  palette,
  radius,
  serif,
  space,
  tabBarClearance,
  text,
  tone,
} from "@/constants/design";
import { useDirectory } from "@/data/directory-context";
import { emptySinger, genres, type Singer } from "@/data/singers";
import ActionSheet from "./action-sheet";
import {
  ActionButton,
  EmptyState,
  Eyebrow,
  Icon,
  IconButton,
  Portrait,
} from "./directory-ui";

const SORT_LABEL = { az: "A–Z", newest: "Newest" } as const;
type Sort = keyof typeof SORT_LABEL;

function SingerCard({ singer }: { singer: Singer }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${singer.name}`}
      onPress={() => router.push(`/singer/${singer.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Portrait singer={singer} />
      <View style={styles.cardMeta}>
        <View style={styles.cardText}>
          <Text style={text.title3} numberOfLines={2}>
            {singer.name}
          </Text>
          <Text style={[text.subhead, tone.muted]} numberOfLines={1}>
            {singer.genre}
            {singer.hometown ? ` · ${singer.hometown}` : ""}
          </Text>
        </View>
        {singer.favorite === 1 && (
          <Icon name="bookmark" size={17} color={palette.accent} />
        )}
      </View>
    </Pressable>
  );
}

export default function DirectoryScreen({
  savedOnly = false,
}: {
  savedOnly?: boolean;
}) {
  const { singers } = useDirectory();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");
  const [sort, setSort] = useState<Sort>("az");
  const [listMode, setListMode] = useState(false);
  const [sortSheet, setSortSheet] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const available = savedOnly
    ? singers.filter((singer) => singer.favorite === 1)
    : singers;
  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase();
    return singers
      .filter(
        (singer) =>
          (!savedOnly || singer.favorite === 1) &&
          (genre === "All" || singer.genre === genre) &&
          `${singer.name} ${singer.genre} ${singer.hometown} ${singer.song}`
            .toLocaleLowerCase()
            .includes(needle),
      )
      .sort((a, b) =>
        sort === "az" ? a.name.localeCompare(b.name) : b.id - a.id,
      );
  }, [singers, deferredQuery, genre, savedOnly, sort]);
  const columns =
    listMode || fontScale > 1.4 ? 1 : width >= 900 ? 4 : width >= 650 ? 3 : 2;
  const gutter = gutterFor(width);

  // Pad the final row so its cards keep the same width as every row above it.
  const cells = useMemo(() => {
    if (columns === 1 || filtered.length === 0) return filtered;
    const missing = (columns - (filtered.length % columns)) % columns;
    return missing === 0
      ? filtered
      : [
          ...filtered,
          ...Array.from({ length: missing }, (_, index) => ({
            ...emptySinger,
            id: -1 - index,
            favorite: 0,
            createdAt: "",
            updatedAt: "",
          })),
        ];
  }, [columns, filtered]);

  const header = (
    <View style={styles.header}>
      <View style={styles.masthead}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Icon name="radio" color="#ffffff" size={19} />
          </View>
          <Text style={styles.wordmark} maxFontSizeMultiplier={1.3}>
            tinig<Text style={tone.accent}>.</Text>
          </Text>
        </View>
        <ActionButton
          label="Add singer"
          icon="plus"
          secondary
          onPress={() => router.push("/singer/new")}
        />
      </View>

      <View style={styles.hero}>
        <Eyebrow>
          {savedOnly
            ? "Your personal collection"
            : "The Philippine singers directory"}
        </Eyebrow>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={displayMaxScale}
          style={displayStyle(width)}
        >
          {savedOnly
            ? "Keep your\nfavorites close."
            : "Our voices.\nOur stories."}
        </Text>
        <Text style={[text.body, tone.muted, styles.lede]}>
          {savedOnly
            ? "The voices you come back to, all in one place."
            : "Discover the voices and stories behind Filipino music."}
        </Text>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={19} color={palette.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search singers, genres, places…"
          accessibilityLabel="Search singers"
          placeholderTextColor={palette.muted}
          style={[text.body, styles.searchInput]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <IconButton
            label="Clear search"
            name="x"
            onPress={() => setQuery("")}
          />
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -gutter }}
        contentContainerStyle={[styles.chips, { paddingHorizontal: gutter }]}
        keyboardShouldPersistTaps="handled"
      >
        {["All", ...genres].map((item) => {
          const selected = genre === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Filter ${item}`}
              onPress={() => setGenre(item)}
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
                {item === "All" ? "All voices" : item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.listBar}>
        <View style={styles.listBarText}>
          <Text style={text.title2}>
            {savedOnly ? "Saved voices" : "Meet the voices"}
          </Text>
          <Text accessibilityLiveRegion="polite" style={text.caption}>
            {filtered.length} {filtered.length === 1 ? "singer" : "singers"}
            {filtered.length !== available.length
              ? ` of ${available.length}`
              : ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort: ${SORT_LABEL[sort]}. Change sorting`}
          onPress={() => setSortSheet(true)}
          style={({ pressed }) => [styles.sort, pressed && styles.pressed]}
        >
          <Text style={[text.subhead, tone.muted]}>{SORT_LABEL[sort]}</Text>
          <Icon name="chevron-down" size={14} color={palette.muted} />
        </Pressable>
        <IconButton
          label={listMode ? "Switch to grid" : "Switch to list"}
          name={listMode ? "grid" : "list"}
          onPress={() => setListMode(!listMode)}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        key={columns}
        data={cells}
        numColumns={columns}
        keyExtractor={(singer) => String(singer.id)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          width: "100%",
          maxWidth: measure.grid,
          alignSelf: "center",
          paddingHorizontal: gutter,
          paddingTop:
            Platform.OS === "ios" ? space.md : insets.top + space.gutter,
          paddingBottom:
            (Platform.OS === "ios" ? space.section : insets.bottom + space.section) +
            tabBarClearance,
        }}
        columnWrapperStyle={columns > 1 ? { gap: space.md } : undefined}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.id < 0 ? (
            <View style={{ flex: 1 / columns }} />
          ) : columns === 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${item.name}`}
              onPress={() => router.push(`/singer/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowPortrait}>
                <Portrait singer={item} />
              </View>
              <View style={styles.rowText}>
                <Text style={text.title3}>{item.name}</Text>
                <Text style={[text.subhead, tone.muted]}>
                  {item.genre}
                  {item.hometown ? ` · ${item.hometown}` : ""}
                </Text>
              </View>
              {item.favorite === 1 && (
                <Icon name="bookmark" size={16} color={palette.accent} />
              )}
              <Icon name="chevron-right" size={19} color={palette.muted} />
            </Pressable>
          ) : (
            <View style={{ flex: 1 / columns }}>
              <SingerCard singer={item} />
            </View>
          )
        }
        ListEmptyComponent={
          <EmptyState
            title={
              query || genre !== "All"
                ? "No voices found"
                : savedOnly
                  ? "A place for your favorites"
                  : "Every directory starts with a voice"
            }
            description={
              query || genre !== "All"
                ? "Try a different name or clear your filters."
                : savedOnly
                  ? "Open a singer’s profile and tap Save singer to find them here."
                  : "Add your first Filipino singer to get started."
            }
            action={
              query || genre !== "All" ? (
                <ActionButton
                  secondary
                  label="Clear filters"
                  onPress={() => {
                    setQuery("");
                    setGenre("All");
                  }}
                />
              ) : (
                <ActionButton
                  label={savedOnly ? "Discover singers" : "Add singer"}
                  onPress={() =>
                    router.push(savedOnly ? "/directory" : "/singer/new")
                  }
                />
              )
            }
          />
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <View style={styles.footer}>
              <Icon name="music" size={18} color={palette.accent} />
              <Text style={text.caption}>A little closer to the music.</Text>
            </View>
          ) : null
        }
        initialNumToRender={12}
        windowSize={5}
      />

      <ActionSheet
        visible={sortSheet}
        onClose={() => setSortSheet(false)}
        title="Sort singers"
        description="Choose the order of the directory."
        actions={[
          {
            label: "Alphabetical",
            detail: "A to Z by name",
            icon: "align-left",
            selected: sort === "az",
            onPress: () => setSort("az"),
          },
          {
            label: "Recently added",
            detail: "Newest profiles first",
            icon: "clock",
            selected: sort === "newest",
            onPress: () => setSort("newest"),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  header: { gap: space.md, paddingBottom: space.md },
  masthead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.sm,
    paddingBottom: space.group,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.xs },
  brandMark: {
    height: 36,
    width: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontFamily: serif,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    color: palette.ink,
  },
  hero: { gap: space.sm, paddingTop: space.xs },
  lede: { maxWidth: 460 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderRadius: radius.lg,
    backgroundColor: palette.soft,
    paddingLeft: space.group,
    paddingRight: space.tight,
  },
  searchInput: { flex: 1, minHeight: hitSize + 8, paddingVertical: space.sm },
  chips: { gap: space.xs },
  chip: {
    minHeight: hitSize,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: space.group,
  },
  chipSelected: { backgroundColor: palette.ink },
  chipIdle: { borderWidth: 1, borderColor: palette.line },
  listBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  listBarText: { flex: 1, gap: space.hair },
  sort: {
    minHeight: hitSize,
    paddingHorizontal: space.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: space.hair + 2,
  },
  card: { flex: 1, gap: space.sm, paddingBottom: space.md },
  cardMeta: { flexDirection: "row", alignItems: "flex-start", gap: space.xs },
  cardText: { flex: 1, gap: space.hair },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.group,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  rowPortrait: { width: 72 },
  rowText: { flex: 1, gap: space.hair },
  pressed: { opacity: 0.6 },
  footer: {
    alignItems: "center",
    gap: space.xs,
    marginTop: space.group,
    paddingTop: space.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
});
