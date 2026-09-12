# Validation

Verified September 12, 2026 on Windows with Node 24 and Chromium.

## Automated checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 3 tests passed. The tests exercise the shared repository against real temporary SQLite files: create/read/update/delete, trimming, bound values containing apostrophes and SQL-like strings, duplicate rejection, favorite preservation during edits, persistence after reopening, no reseeding after all rows are deleted, invalid URLs, length validation, and rollback/retry of a failed first migration.
- `npx expo-doctor`: all 21 checks passed.
- `npx expo export --platform all --output-dir dist`: web, Android, and iOS exports passed. The browser export includes a locally bundled SQLite WASM file and Tailwind CSS. Native exports compile the iOS SwiftUI button and native tabs.

## Browser interaction checks

Playwright CLI was used against the real running app, with no repository or network mocks.

- Fresh browser database displays six starter singers.
- Create a test singer with name, hometown, and biography; reload the profile and confirm persisted data.
- Submit an empty name and verify the inline validation message.
- Edit a singer to an existing name and verify duplicate rejection without losing the draft; correct the name, change genre, add a signature song, and save successfully.
- Save a singer and verify it appears in Saved after a reload.
- Cancel deletion and retain the profile; accept deletion and return to the directory without that test profile.
- Search for an unmatched name, see the empty state, and recover with Clear filters.
- Apply the Pop filter and verify only matching singers remain.
- Cancel a dirty form: dismiss the confirmation to keep the draft, then accept it to discard the draft.
- Open a missing singer URL and verify the not-found state and return action.
- Inspect screenshots at 390×844, 375×812, 844×390, and 1280×900. Content scrolls within the available viewport and the navigation remains accessible.
- Serve the production `dist` folder separately with `serve -s`: verify fresh startup, direct singer URL loading, saving a favorite, and favorite persistence after reload. Production browser console: zero errors and zero warnings during this smoke check.

Screenshots are local, ignored development artifacts under `output/playwright/`:

- `discover-mobile.png`
- `discover-small-phone.png`
- `discover-desktop.png`
- `discover-landscape.png`

## Limits

- No real iPhone, Android device, or native simulator runtime was available for verification. Native exports are compilation evidence, not device interaction evidence.
- Native keyboard avoidance, Dynamic Type at the largest size, VoiceOver/TalkBack, and safe-area behavior need a device pass. Browser resizing does not verify these native behaviors.
- No performance or large-directory benchmark was run. List virtualization, deferred search, cached images, and serialized database operations are present, but device frame-rate/startup claims are not made.
- Expo SQLite web workers failed to bundle on this Windows setup. The implemented browser path uses SQLite WASM and IndexedDB instead. Modern browser Web Locks and a secure context (HTTPS or localhost) are required. A browser cold launch without internet is not supported by a service worker.
- Some starter portrait URLs depend on Wikimedia availability. The UI falls back to initials when an image fails. Three portraits are bundled; Regine uses initials.
- Local-only data has no cloud backup or sync. Deleting app/site storage deletes its directory. Browser tabs refresh their displayed data on reload or after a local mutation; they do not push live changes to one another.
- npm reported 14 moderate dependency advisories during installation. No forced major-version dependency changes were applied. Review `npm audit` before a public release.

No commits or deployment were made. Existing edits to `src/hooks/use-color-scheme.web.ts` were preserved.
