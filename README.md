# Tinig

A Filipino singers directory built with Expo 57, TypeScript, Tailwind 4, and SQLite.

## Run

Use Node 24 LTS (Expo requires at least Node 22.13; repository tests use Node's SQLite module).

```powershell
npm install
npx expo start
```

Scan the terminal QR code with a matching Expo Go version on your phone. Windows cannot run Apple's iOS simulator. For browser preview:

```powershell
npm run web -- --port 8082
```

Open http://localhost:8082. If you installed with lifecycle scripts disabled, run `node scripts/prepare-web.cjs` before opening web. No API keys, backend, or account are needed.

For a production browser preview, run `npx expo export --platform web` followed by `npx serve -s dist`. Web hosting must serve `index.html` for application routes, including `/singer/7`, and serve `/sql-wasm.wasm` as a real file. SQLite records are local, so these routes cannot be pre-rendered with singer data at build time.

## Features

- Create, browse, edit, and delete singers.
- Six sourced starter profiles, portrait fallbacks, and visible photo credits.
- Search by name, genre, hometown, or signature song.
- Genre filters, alphabetical/newest sorting, grid/list views, and saved singers.
- Required-name and URL validation, duplicate-name protection, delete confirmation, and unsaved-change protection.
- SQLite persistence across restarts, one-time transactional seeding, and bound SQL parameters.
- Native mobile tab bars and an iOS SwiftUI save button through Expo UI.

Mobile uses `expo-sqlite` in `tinig.db`. Web uses the same SQL repository with sql.js (SQLite WASM), storing the file in IndexedDB. Each device/browser/site address has its own directory. No cloud sync. Clearing app/site data removes records. Mobile CRUD works offline; browser offline use is limited to an already loaded page, and remote images/links need internet.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform ios --platform android --output-dir dist-native
npx expo export --platform web
```

Tests use isolated temporary SQLite files, not your app database. Metro regenerates `.expo/types/router.d.ts` on startup. If Windows hot reload leaves stale route types after adding files, restart Metro before rerunning typecheck.

## Project map

- `src/app/`: discover/saved/about tabs and singer CRUD routes.
- `src/components/`: directory UI, profile form, and platform-specific controls.
- `src/data/repository.ts`: shared SQL and schema migration.
- `src/data/connection.ts`: native SQLite connection.
- `src/data/connection.web.ts`: persistent browser SQLite adapter.
- `src/global.css`: Tailwind theme.
- `tests/repository.test.ts`: real SQLite persistence, CRUD, validation, and rollback checks.
- [Research and sources](docs/RESEARCH.md)
- [Validation and known limits](docs/VALIDATION.md)
- [Portrait attribution](assets/artists/ATTRIBUTION.md)

Light appearance is intentional. Native runtime, keyboard behavior, VoiceOver/TalkBack, and largest Dynamic Type sizes must still be checked on real devices; native bundle exports alone do not establish those results.
