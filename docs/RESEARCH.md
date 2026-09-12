# Tinig: research and implementation decisions

Research date: September 12, 2026. Design research was delegated to Terra. Apple UI and skill research were delegated to Luna, as requested.

## Design references

| Reference | Evidence and useful direction |
| --- | --- |
| [Dribbble: Artist Booking Mobile App](https://dribbble.com/shots/27090357-Artist-Booking-Mobile-App-UI) | Accessible project description covers category, style, location discovery, and artist profiles. Informed the search, genre filters, and profile hierarchy. |
| [Dribbble: Live Concert Artist Discovery](https://dribbble.com/shots/27064896-Live-Concert-Artist-Discovery-App-UI) | Artist discovery concept with a more immersive, dark direction. Useful for the prominence of artist imagery. |
| [Dribbble: Record Label Artists Screen](https://dribbble.com/shots/27093294-Record-Label-Music-App-Artists-Screen) | Description emphasizes ranked cards, hierarchy, and readable artist information. |
| [Pinterest: music mobile UI reference](https://in.pinterest.com/pin/music-app-mobile-app-ui-mobile-ui-design--518758450800941388/) | Pinterest exposed title/metadata only. Included as an inspiration link, not claimed as a complete visual review. |
| [Pinterest: mobile app reference](https://kr.pinterest.com/pin/pinterest-in-2024--35254809576665219/) | Same access limitation. |
| [Behance: Music App UI](https://www.behance.net/gallery/233714667/Music-App-UI-Neumorphic-Mobile-app-Design) | A contrasting neumorphic music concept. The directory uses clearer boundaries and text contrast. |

The resulting visual direction is an editorial artist directory: warm paper, dark ink, restrained vermilion, serif headlines, system sans-serif body text, portrait cards, and a compact searchable list alternative. It is an original implementation, not a copied screen. Shared colors live in `src/global.css` and `directory-ui.tsx`. Touch targets are at least 48 logical pixels for primary controls. The layout responds to available width and switches to a single column at larger native text scales.

## The Apple API question

There is no single Apple API that designs an app automatically. The likely reference is **SwiftUI or UIKit**, together with Apple's design system:

- [SwiftUI controls](https://developer.apple.com/documentation/swiftui/controls-and-indicators) supply native control sizing and interaction behavior.
- [Size classes](https://developer.apple.com/documentation/swiftui/userinterfacesizeclass), [Dynamic Type](https://developer.apple.com/documentation/swiftui/dynamictypesize), and [UIKit safe areas](https://developer.apple.com/documentation/uikit/uiview/safearealayoutguide) adapt layout to space, accessibility settings, and device chrome.
- [Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) and [Apple Design Resources](https://developer.apple.com/design/resources/) provide guidance and design assets.

Expo 57 exposes native SwiftUI through [`@expo/ui/swift-ui`](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/). This app uses a native SwiftUI save button inside `Host` on iOS and [Expo Router native tabs](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/) on mobile. Branded content and validated forms use shared React Native components. This retains Android and browser support. Native device appearance still requires device testing.

## Stack decisions

- The starter already had Expo 57, React Native 0.86, Expo Router, Expo UI, Reanimated, safe-area support, and Expo Image. Exact [Expo v57 docs](https://docs.expo.dev/versions/v57.0.0/) were read before code changes.
- Installed **Tailwind 4 + Uniwind** for actual cross-platform `className` support. [Uniwind's official setup](https://docs.uniwind.dev/quickstart) supports Tailwind 4 and does not need an extra Babel preset. Package peer dependencies matched this starter. No claim that it is universally faster than every styling alternative.
- Installed **Expo SQLite** for iOS and Android. [The v57 API](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) supplies persistent, asynchronous database access. User values use bound parameters. First-run schema creation and seeding are transactional and versioned. Deleting all singers does not reseed them.
- This Windows environment reproduced `Worker chunk not found ... expo-sqlite/web/worker.ts`, including after a clean Metro rebuild. Expo documents SQLite web support as alpha. The browser therefore uses **[sql.js](https://github.com/sql-js/sql.js)**, which is real SQLite compiled to WASM, and persists the database bytes in IndexedDB. Its engine is bundled locally by `scripts/prepare-web.cjs`. Web Locks serialize access across tabs. Both platforms share the SQL repository. No node_modules patch or mock browser database is used.
- FlatList virtualizes rendered cards. Search uses a deferred query, images use Expo Image caching and fallback initials, and write operations are serialized. These are implementation choices, not device benchmark results.
- Web storage requires a modern browser on localhost or HTTPS. The browser app must load before offline interaction; no service worker/offline cold launch is provided. Native directory operations work offline. External portraits and source links require internet.

## Installed skills

Luna researched skills via skills.sh and repository sources, then installed the following. Skills guide development; they are not app runtime packages. Restart your agent session if a newly installed skill does not appear in its catalog.

| Skills | Source | Location |
| --- | --- | --- |
| expo-native-ui, expo-ui, expo-design-system, expo-animation | [Official Expo skills](https://github.com/expo/skills) | `C:/Users/MYPC/.codex/skills/` |
| expo, ios-taste, tailwind | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) | `C:/Users/MYPC/.codex/skills/` |
| expo-react-native-performance | [Performance skill listing](https://www.skills.sh/pproenca/dot-skills/expo-react-native-performance) | `C:/Users/MYPC/.agents/skills/` |
| mobile-app-ui-design | [ceorkm/mobile-app-ui-design](https://github.com/ceorkm/mobile-app-ui-design) | `C:/Users/MYPC/.agents/skills/` |
| ui-mobile | [alinaqi/maggy](https://github.com/alinaqi/maggy) | Both skill roots above |

For ongoing work, start with Expo's official UI skills, the performance skill, and Tailwind guidance. Some community skills contain older API examples or strong aesthetic preferences; the installed version's declarations, Expo v57 docs, and project requirements take precedence. The pre-existing UI/UX Pro Max skill had no bundled search script in this installation; its written accessibility and layout guidance was used.

## Seed sources and portrait licenses

Six starter profiles: [Gary Valenciano](https://www.garyv.com/about-gary-v), [Regine Velasquez](https://music.apple.com/us/artist/regine-velasquez/32340032), [Lea Salonga](https://www.leasalonga.com/about), [Sarah Geronimo](https://sarah-geronimo.com/), [Moira dela Torre](https://www.tatlerasia.com/people/moira-dela-torre), and [Bamboo Mañalac](https://music.apple.com/us/artist/bamboo-manalac/324891781). Genre labels are broad directory categories, not exhaustive classifications. Unverified hometowns and signature songs are left blank.

Photo attribution is in the app's About page and `assets/artists/ATTRIBUTION.md`. Three portraits are bundled locally. Sarah and Bamboo use verified Commons URLs because download attempts were rate-limited. Regine has an initials placeholder. User-provided portrait URLs override starter imagery.
