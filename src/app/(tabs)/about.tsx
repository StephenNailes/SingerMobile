import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionButton,
  ExternalButton,
  Eyebrow,
  Icon,
  portraitCredits,
} from "@/components/directory-ui";
import Sheet from "@/components/sheet";
import {
  displayMaxScale,
  measure,
  palette,
  radius,
  space,
  tabBarClearance,
  text,
  tone,
} from "@/constants/design";

export default function About() {
  const insets = useSafeAreaInsets();
  const [credits, setCredits] = useState(false);
  return (
    <View style={styles.screen}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop:
              Platform.OS === "ios" ? space.section : insets.top + space.section,
            paddingBottom:
              (Platform.OS === "ios"
                ? space.section
                : insets.bottom + space.section) + tabBarClearance,
          },
        ]}
      >
        <View style={styles.intro}>
          <Icon name="radio" color={palette.accent} size={32} />
          <Eyebrow>A home for Filipino voices</Eyebrow>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={displayMaxScale}
            style={text.displayXL}
          >
            {"A little closer\nto the music."}
          </Text>
          <Text style={[text.body, tone.muted]}>
            Tinig means “voice” in Filipino. This is your personal directory of
            the singers who give our music its character.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={text.title3}>Yours, on this device</Text>
          <Text style={[text.callout, tone.muted]}>
            Profiles and saved singers stay in a local SQLite database. They
            work offline and remain after restarting the app. There is no
            account or cloud sync. Clearing the app’s data or uninstalling it
            removes your directory.
          </Text>
          <Text style={[text.callout, tone.muted]}>
            On the web, records belong to this browser and site address.
            Clearing site data removes them. External links and linked portraits
            use the internet.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={text.title2}>
            A starting point, not a complete catalog
          </Text>
          <Text style={[text.body, tone.muted]}>
            The starter profiles link to their biographical sources. Genre
            labels are broad browsing categories. You can edit every profile,
            add your own entries, and remove any singer.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={text.title2}>Photo credits</Text>
          <Text style={[text.body, tone.muted]}>
            Portraits are sourced from Wikimedia Commons and cropped for
            display. Every original file and its license is listed with a link.
          </Text>
          <ActionButton
            secondary
            icon="image"
            label="View photo credits"
            onPress={() => setCredits(true)}
          />
        </View>

        <Text style={[text.eyebrow, tone.muted, styles.colophon]}>
          Tinig · Version 1.0
        </Text>
      </ScrollView>

      <Sheet
        visible={credits}
        onClose={() => setCredits(false)}
        title="Photo credits"
        description="Portraits from Wikimedia Commons, cropped for display."
        detents={["medium", "large"]}
        scrollable
      >
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.creditList}
        >
          {portraitCredits.map((credit) => (
            <View key={credit.name} style={styles.credit}>
              <View style={styles.creditHeading}>
                <Text style={text.headline}>{credit.name}</Text>
                <Text style={text.caption}>
                  {credit.author} · {credit.license}
                </Text>
              </View>
              <ExternalButton
                url={credit.url}
                label={`${credit.name} photo source`}
              />
              <ExternalButton
                url={credit.licenseUrl}
                label={`View ${credit.license} license`}
              />
            </View>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: {
    paddingHorizontal: space.gutter,
    gap: space.section,
    maxWidth: measure.prose,
    width: "100%",
    alignSelf: "center",
  },
  intro: { gap: space.sm },
  card: {
    backgroundColor: palette.soft,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  section: { gap: space.sm },
  fill: { flex: 1 },
  creditList: { gap: space.group, paddingBottom: space.section },
  credit: {
    gap: space.xs,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
  },
  creditHeading: { gap: space.hair },
  colophon: { textAlign: "center" },
});
