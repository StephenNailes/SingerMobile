import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from "react-native";
import {
  hitSize,
  palette,
  radius,
  serif,
  space,
  text,
  tone,
} from "@/constants/design";
import type { Singer } from "@/data/singers";

export { palette, serif } from "@/constants/design";

export function Icon({
  name,
  size = 21,
  color = palette.ink,
}: {
  name: ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: ColorValue;
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessible={false}
      aria-hidden
    />
  );
}

export function ActionButton({
  label,
  onPress,
  secondary = false,
  busy = false,
  icon,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  icon?: ComponentProps<typeof Feather>["name"];
  danger?: boolean;
}) {
  const background = secondary
    ? palette.paper
    : danger
      ? palette.danger
      : palette.accent;
  const foreground = secondary
    ? danger
      ? palette.danger
      : palette.ink
    : "#ffffff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        secondary && {
          borderWidth: 1,
          borderColor: danger ? palette.danger : palette.line,
        },
        (pressed || busy) && styles.faded,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Icon name={icon} size={18} color={foreground} />
      ) : null}
      <Text
        style={[text.headline, { color: foreground }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  label,
  name,
  onPress,
  active = false,
  busy = false,
}: {
  label: string;
  name: ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  active?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, selected: active }}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: active ? palette.soft : "transparent" },
        (pressed || busy) && styles.faded,
      ]}
    >
      <Icon name={name} color={active ? palette.accent : palette.ink} />
    </Pressable>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Text style={text.eyebrow} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Icon name="alert-circle" size={18} color={palette.accent} />
      <Text
        selectable
        accessibilityRole="alert"
        style={[text.callout, tone.accent, styles.noticeText]}
      >
        {children}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyBadge}>
        <Icon name="mic" color={palette.accent} size={28} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={[text.title1, styles.centered]}>{title}</Text>
        <Text style={[text.body, tone.muted, styles.centered]}>
          {description}
        </Text>
      </View>
      {action}
    </View>
  );
}

export const portraitCredits = [
  {
    name: "Gary Valenciano",
    author: "Manonica",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Gary_Valenciano.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: require("@/assets/artists/gary-valenciano.jpg"),
  },
  {
    name: "Lea Salonga",
    author: "RTVMalacanang",
    license: "Public domain",
    url: "https://commons.wikimedia.org/wiki/File:Lea_Salonga_-_2014.jpg",
    licenseUrl: "https://commons.wikimedia.org/wiki/Template:PD-PhilippinesGov",
    source: require("@/assets/artists/lea-salonga-2014.jpg"),
  },
  {
    name: "Moira dela Torre",
    author: "ChasterJohn Luna",
    license: "CC BY 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Moira_performing_in_2019.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    source: require("@/assets/artists/moira-dela-torre-2019.jpg"),
  },
  {
    name: "Sarah Geronimo",
    author: "Jakezakk",
    license: "CC BY-SA 4.0",
    url: "https://commons.wikimedia.org/wiki/File:Fusion_Sarah_G_(cropped).jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: {
      uri: "https://upload.wikimedia.org/wikipedia/commons/2/26/Fusion_Sarah_G_%28cropped%29.jpg",
    },
  },
  {
    name: "Bamboo Mañalac",
    author: "Exec8 and Magalhães",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Bamboo_Manalac.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: {
      uri: "https://upload.wikimedia.org/wikipedia/commons/3/33/Bamboo_Manalac.jpg",
    },
  },
];

export function Portrait({
  singer,
  large = false,
}: {
  singer: Pick<Singer, "name" | "imageUrl">;
  large?: boolean;
}) {
  const [failedSource, setFailedSource] = useState("");
  const sourceKey = `${singer.name}-${singer.imageUrl}`;
  const credit = portraitCredits.find((p) => p.name === singer.name);
  const source = singer.imageUrl ? { uri: singer.imageUrl } : credit?.source;
  const initials = singer.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
  return (
    <View style={[styles.portrait, { aspectRatio: large ? 1.2 : 0.85 }]}>
      {source && failedSource !== sourceKey ? (
        <Image
          source={source}
          contentFit="cover"
          contentPosition="top"
          recyclingKey={sourceKey}
          cachePolicy="memory-disk"
          onError={() => setFailedSource(sourceKey)}
          accessibilityLabel={`Portrait of ${singer.name}`}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.portraitFallback}>
          <Text
            style={{
              fontFamily: serif,
              fontSize: large ? 84 : 52,
              lineHeight: large ? 96 : 60,
              letterSpacing: -2,
              color: palette.accent,
            }}
            maxFontSizeMultiplier={1.2}
          >
            {initials || "♪"}
          </Text>
          <Text style={[text.eyebrow, tone.muted]}>Portrait to come</Text>
        </View>
      )}
    </View>
  );
}

export function ExternalButton({ url, label }: { url: string; label: string }) {
  const [error, setError] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <ActionButton
        secondary
        icon="external-link"
        label={label}
        onPress={() => {
          setError(false);
          Linking.openURL(url).catch(() => setError(true));
        }}
      />
      {error && (
        <Notice>
          Couldn’t open this link. Check your connection and try again.
        </Notice>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: hitSize + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  faded: { opacity: 0.55 },
  iconButton: {
    height: hitSize,
    width: hitSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  notice: {
    flexDirection: "row",
    gap: space.xs,
    borderRadius: radius.md,
    backgroundColor: palette.soft,
    padding: space.sm,
  },
  noticeText: { flex: 1 },
  empty: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xxl,
    paddingHorizontal: space.gutter,
  },
  emptyBadge: {
    height: 64,
    width: 64,
    borderRadius: radius.pill,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCopy: { gap: space.xs, maxWidth: 360 },
  centered: { textAlign: "center" },
  portrait: {
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: palette.soft,
  },
  portraitFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
  },
});
