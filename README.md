# Taktung

**Taktung** (German: *putting work on a beat*) is a local-first **Vercel operations assistant** for React Native / Expo. The App Store name is Taktung because Takt is already used by other apps. The default URL scheme is `takt`.

> Show me what changed, explain what broke, and prepare the safest next action.

This is **not** a full Vercel dashboard clone. It is a mobile control plane for incident, deployment, and configuration intelligence—with hard confirmation for mutators and honest success/failure in Activity.

Source is [MIT](LICENSE). The package `private` flag only prevents accidental npm publication.

---

## Features

| Area | What you get |
|------|----------------|
| **Home / projects** | Selected **site** (project) briefing, production state, needs-attention, check-for-issues brief. Site rows show domain, git repo, and last commit. Header switches sites on every tab |
| **Deployments** | List + detail. Logs / Diagnose / Compare / Errors are panes (not stacked). Redeploy / promote / rollback stay hard-confirm actions |
| **Inspect hosts** | Assigned aliases classified as production / alias / branch / commit (from deployment detail — no extra list N+1) |
| **Functions** | Inventory from the published file tree, hashed lambda outputs, or an honest empty when Vercel did not publish routes |
| **Incident summary** | Deterministic diagnosis from logs, env presence, last success |
| **Env drift** | Names and targets only—**never secret values** |
| **Domains** | Verification / DNS / SSL signals and misconfiguration hints |
| **Observability** | Metrics with honest empty states (not enabled / plan / no data) |
| **Firewall & flags** | Read-only explain / metadata (no mutations from the app) |
| **Runtime logs** | Validated filters (e.g. production 5xx since this morning) |
| **READY poll** | After mutators, Activity records READY only when Vercel confirms |
| **Auth** | Vercel OAuth (PKCE) or personal access token |
| **Search** | On-device lookup that returns a summary plus reused ops widgets in place (not tab hops). Hidden if the OS model is unavailable |
| **UI** | Liquid Glass chrome on iOS; Material 3 tonal surfaces / FAB on Android |

### Safety rules

- Env variable **values** never enter the UI, Activity, or ops brief  
- No arbitrary shell or free-form API from model output  
- Typed, allow-listed actions only  
- Hard confirmation for redeploy, promote, rollback  
- Deployment success is only claimed when Vercel reports **READY**  

### Control plane

```text
Vercel adapter
  → normalized resources
  → typed action plans
  → local analysis
  → review / hard confirm
  → confirmed execution
  → activity / audit history
```

---

## App structure

```text
takt/
├── app/                    # Expo Router (not src/app)
│   ├── _layout.tsx         # AppProvider + native Stack
│   ├── (tabs)/             # NativeTabs (system Liquid Glass tab bar)
│   ├── settings.tsx        # Native form sheet
│   ├── sites.tsx           # Site picker form sheet
│   ├── deployment/[id].tsx # Native form sheet
│   ├── hosts/[id].tsx      # Assigned hosts form sheet
│   └── functions/[id].tsx  # Function inventory form sheet
├── app.config.ts           # Expo config (identity from `.env`)
├── .env.example            # Required env keys for a real build
├── package.json
├── vitest.config.ts
├── .maestro/smoke.yaml     # UI smoke skeleton
├── docs/
│   ├── product-direction.md
│   └── implementation-notes.md
├── __tests__/              # Domain + service unit tests
└── src/
    ├── shell/              # Global state (not src/app — Expo Router collision)
    │   ├── AppContext.tsx  # Connection, projects, plans, poll, brief
    │   └── nav.ts          # Router helpers
    ├── design-system/      # Theme, glass chrome, buttons
    ├── domain/             # Pure logic (no React / network)
    │   ├── models/         # IDs, Vercel resource types
    │   ├── actions/        # Allow-listed TaktAction + plans
    │   ├── policies/       # Confirmation / risk
    │   └── analysis/       # Health, drift, incident, logs, brief, …
    ├── services/           # Side effects
    │   ├── api/            # Vercel REST client
    │   ├── auth/           # SecureStore, PAT, OAuth PKCE
    │   ├── storage/        # Activity + project snapshot cache
    │   └── actions/        # executeApprovedPlan
    ├── features/           # Screens / sheets
    │   ├── home/
    │   ├── sites/
    │   ├── deployments/
    │   ├── activity/
    │   ├── settings/
    │   └── command/
    └── support/            # Accessibility IDs, helpers
```

| Layer | Responsibility |
|-------|----------------|
| **shell** | Navigation, global context, orchestration |
| **domain** | Pure analysis, actions, policies (unit-tested) |
| **services** | Network, secure storage, plan execution |
| **features** | UI screens |
| **design-system** | HIG Liquid Glass + Material 3 tokens |

Path aliases (see `tsconfig.json` / Vitest): `@/*` → `src/*`.

---

## Configure identity (required for a proper build)

Copy the example env file and fill in values for **your** app:

```bash
cp .env.example .env
```

Expo loads `.env` automatically. Anything prefixed `EXPO_PUBLIC_` is inlined into the JS bundle.

| Variable | Required for | Purpose |
|---|---|---|
| `EXPO_PUBLIC_APP_NAME` | Display | Home-screen name (default `Taktung`) |
| `EXPO_PUBLIC_SLUG` | EAS / Expo | Project slug (default `takt`) |
| `EXPO_PUBLIC_SCHEME` | OAuth, App Intents | URL scheme (default `takt`) |
| `EXPO_PUBLIC_BUNDLE_ID` | iOS device / store | Reverse-DNS bundle ID. Default `com.example.takt` is for local simulators only |
| `EXPO_PUBLIC_ANDROID_PACKAGE` | Android | Application ID (defaults to the iOS bundle ID) |
| `EXPO_PUBLIC_APPLE_TEAM_ID` | Device / store | Apple Developer team ID |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | EAS Build | From `eas init` |
| `EXPO_PUBLIC_EAS_OWNER` | EAS | Expo account that owns the project |
| `EXPO_PUBLIC_ASC_APP_ID` | TestFlight / submit | App Store Connect app ID |
| `EXPO_PUBLIC_VERCEL_CLIENT_ID` | OAuth | Vercel OAuth app client ID. Leave empty for PAT-only auth |
| `EXPO_PUBLIC_OAUTH_REDIRECT_URI` | OAuth | Must match the Vercel app. Default `{scheme}://oauth/callback` |
| `EXPO_PUBLIC_VERCEL_OAUTH_SCOPE` | OAuth | Default `offline_access` |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Settings / store | Hides the Privacy Policy link when empty |
| `EXPO_PUBLIC_SUPPORT_URL` | Store listing | Support URL |
| `EXPO_PUBLIC_OTHER_APP_STORE_URL` | Settings (iOS) | Optional “other apps” row; hidden when empty |
| `EXPO_PUBLIC_OTHER_APP_NAME` | Settings (iOS) | Title for that row |
| `EXPO_PUBLIC_OTHER_APP_BLURB` | Settings (iOS) | Two-line description |
| `IPHONE_UDID` / `IPAD_UDID` | Screenshot script | Simulator identifiers |

For App Store / TestFlight you also need signing credentials on EAS or in Xcode. Put `appleTeamId` and `ascAppId` into `eas.json` `submit.production.ios` locally if you use `eas submit` — those IDs are not committed.

Replace `assets/other-app-icon.png` if you enable the other-apps row.

### Prerequisites

- **Node.js** 20.19+ or 22 LTS  
- **npm** 10+  
- Optional: iOS Simulator / Android emulator, or a [development build](https://docs.expo.dev/develop/development-builds/introduction/)  
- Optional: [Maestro](https://maestro.mobile.dev/) for UI smoke  

### Clone and install

```bash
git clone https://github.com/jdodsoncollins/takt.git
cd takt
cp .env.example .env
npm install
```

### Verify the workspace

```bash
npm run typecheck
npm test
npm run doctor
npm run audit
npm run verify:quick    # typecheck + tests
```

### Run the app

```bash
npm start               # Expo dev server (QR / press a / i / w)
npm run web             # Browser
npm run android         # Android device or emulator
npm run ios             # iOS Simulator (macOS)
```

Web is useful for UI smoke. **Tokens on web use in-memory storage only**—use a device or simulator for SecureStore-backed auth.

Native **Liquid Glass** (`UIGlassEffect`) and on-device models require a native build (`npm run ios` / `npm run android`). Targets: **iOS 26.4+** (compiled with the **iOS 27 SDK**) and **Android API 35+**. Native iOS builds need **Xcode 27**. SDK 58 prebuild supplies the UIScene lifecycle (`ExpoAppSceneDelegate`). Open **`ios/Taktung.xcworkspace`**, not `Taktung.xcodeproj`. Expo Go and web fall back to blur / opaque chrome and heuristic briefs. App Shortcuts are App Intents and only open screens.

A **Debug** run loads JavaScript from Metro. Leave `npx expo start` running, then `npx expo run:ios --device`. A **Release** run bakes `main.jsbundle` into the binary.

`ios/` is generated and gitignored. Re-run `npx expo prebuild --platform ios` if the workspace is missing. Decline Xcode’s “Upgrade project document compatibility” prompt; if `pod install` then fails with `got Array for attribute shellScript`, run `npm run ios:pods` from the repo root.

```bash
npm run smoke           # typecheck + coverage + optional live Vercel check
```

### Production-like export smokes

```bash
npm run export:web      # → dist-web/
npm run export:android  # → dist-android/
npm run export:ios      # → dist-ios/
```

### UI smoke (optional)

```bash
# App must be installed; set Maestro appId to EXPO_PUBLIC_BUNDLE_ID
npm run smoke:maestro
```

---

## Build process

Taktung is an **Expo managed** app on SDK 58 preview (React Native 0.87), compiled with the iOS 27 SDK. The repository does not check in generated `ios/` or `android/` trees. Development uses a native client, not Expo Go.

| Stage | Command | Output |
|-------|---------|--------|
| Dev | `npm start` | Metro bundler |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |
| Unit tests | `npm test` | Vitest (`__tests__/`) |
| Expo checks | `npm run doctor` | Expo dependency and config validation |
| Dependency audit | `npm run audit` | Fails on unexpected advisories; Metro `image-size` is allowlisted |
| Android prebuild | `npm run prebuild:android` | Generated ignored `android/` tree |
| iOS prebuild | `npm run prebuild:ios` | Generated ignored `ios/` tree |
| Web export | `npm run export:web` | Static bundle in `dist-web/` |
| Android export | `npm run export:android` | Export in `dist-android/` |
| iOS export | `npm run export:ios` | Export in `dist-ios/` |

### Scripts reference

| Script | Purpose |
|--------|---------|
| `npm start` | Expo dev server |
| `npm run web` / `android` / `ios` | Platform entry |
| `npm run typecheck` | Strict TypeScript |
| `npm test` / `test:watch` | Vitest |
| `npm run verify:quick` | typecheck + tests |
| `npm run doctor` / `audit` | Expo and dependency checks |
| `npm run prebuild:android` / `prebuild:ios` | Native config generation checks |
| `npm run export:web` / `export:android` / `export:ios` | Export smoke |
| `npm run smoke:maestro` | Maestro chrome path |

### Native release builds

For store or TestFlight builds, use [EAS Build](https://docs.expo.dev/build/introduction/) or `npx expo prebuild` then native tooling. Identifiers come from `.env` (`EXPO_PUBLIC_BUNDLE_ID`, `EXPO_PUBLIC_SCHEME`).

---

## Authenticate with Vercel

You can connect with **OAuth (PKCE)** or a **personal access token (PAT)**. Tokens stay on-device (SecureStore on iOS/Android).

### Option A — OAuth (recommended when you have a Vercel app)

1. Create a Vercel application (Sign in with Vercel / OAuth app) that can issue tokens for the API scopes you need.  
2. Set the **redirect URI** to:

   ```text
   takt://oauth/callback
   ```

3. Put the **client ID** in `.env`:

   ```bash
   EXPO_PUBLIC_VERCEL_CLIENT_ID=YOUR_CLIENT_ID
   EXPO_PUBLIC_OAUTH_REDIRECT_URI=takt://oauth/callback
   ```

4. Start the app, open **Settings**, tap **Continue with Vercel**.  
5. Complete the browser consent flow. The app exchanges the code with PKCE, validates the account through Vercel's authenticated user endpoint, and stores the access token securely. Taktung does not read identity claims from `id_token`.

If `vercelClientId` is empty, the OAuth button is disabled and the UI explains how to configure it.

### Option B — Personal access token

1. Create a token at [vercel.com/account/tokens](https://vercel.com/account/tokens).  
2. Grant scopes sufficient to **read** projects, deployments, and (as needed) logs/domains. Mutators need write access to create deployments.  
3. Open **Settings** in Taktung → paste the token → **Connect with token**.  
4. Optionally pick a **team** in Settings after connect.

### After you are connected

1. **Home** lists projects (cached snapshot on cold start, then live refresh).  
2. Open a project → **Deploys** for the list, logs, diagnose, and compare. Env drift, domains, firewall, flags, and runtime 5xx live in Search.  
3. Mutators (redeploy / promote / rollback) require a system confirm dialog; Activity shows *accepted / polling*, then **READY** or failure only after poll.  
4. **Disconnect** clears the token from the device.

### Auth troubleshooting

| Symptom | What to try |
|---------|-------------|
| OAuth button disabled | Set `EXPO_PUBLIC_VERCEL_CLIENT_ID` in `.env` |
| OAuth redirect fails | Confirm `EXPO_PUBLIC_SCHEME` and `EXPO_PUBLIC_OAUTH_REDIRECT_URI` match the Vercel app |
| 401 / unauthorized | Token expired or wrong scope—reconnect or create a new PAT |
| Web “token forgotten” | Expected: web uses in-memory store; use a native device for durable auth |
| Empty projects | Check team selection in Settings; ensure the token can see that team |

### Store screenshots (demo mode)

**Off by default.** `npm start`, `npx expo run:ios`, EAS production, and TestFlight never enable it. Metro inlines the flag only when `EXPO_PUBLIC_TAKT_DEMO_MODE=1` (or `true` / `yes`) is set at bundle time. Do not add that variable to `eas.json` or EAS secrets.

When on, the app shows generic sites (`example-portfolio.app`, `example/portfolio`) and generic commit subjects instead of live Vercel data. Fixtures never mix with the live REST path.

```bash
EXPO_PUBLIC_TAKT_DEMO_MODE=1 npx expo run:ios --configuration Release --device "<simulator>"
bash scripts/capture-store-screenshots.sh
```

---

## Dependencies

Runtime (`package.json` `dependencies`):

| Package | Why |
|---|---|
| `expo` | Framework, prebuild, config plugins, CLI |
| `react` / `react-dom` | UI runtime |
| `react-native` | Native views and APIs |
| `expo-router` | File-based navigation, NativeTabs, form sheets |
| `@expo/metro-runtime` | Metro runtime used by Expo |
| `expo-constants` | Reads `app.config.ts` extras (OAuth, URLs) at runtime |
| `expo-linking` | Deep links and OAuth callback |
| `expo-secure-store` | On-device credential storage |
| `@react-native-async-storage/async-storage` | Local snapshots and activity |
| `expo-web-browser` | System-browser OAuth |
| `expo-crypto` | PKCE code challenge |
| `expo-ai-kit` | On-device Apple Intelligence / Gemini Nano for Search |
| `expo-glass-effect` | iOS Liquid Glass chrome |
| `expo-blur` / `expo-linear-gradient` | Fallback chrome when glass is unavailable |
| `expo-haptics` | Confirm-action feedback |
| `expo-image` | Deployment preview thumbs |
| `expo-splash-screen` | Native splash |
| `expo-status-bar` | Status bar style |
| `expo-symbols` | SF Symbols on iOS |
| `expo-system-ui` | System UI / background |
| `expo-font` | Peer of `expo-symbols` |
| `expo-asset` | Bundled assets |
| `expo-build-properties` | iOS 26.4 / Android minSdk |
| `react-native-screens` / `react-native-safe-area-context` / `react-native-gesture-handler` | Navigation primitives |
| `react-native-webview` / `react-native-view-shot` | Live deployment page snapshots |
| `@shopify/flash-list` | Virtualized deploy list |
| `react-native-web` | Web export smoke |

Dev (`devDependencies`):

| Package | Why |
|---|---|
| `typescript` | Strict typecheck |
| `@types/react` | React types |
| `vitest` / `@vitest/coverage-v8` | Unit tests for domain and API mapping |
| `expo-doctor` | SDK / dependency alignment |
| `react-doctor` | Optional React static checks |

`overrides` pin transitive packages with known advisories (`postcss`, `uuid`, `nanoid`, `js-yaml`, `browserslist`, `@xmldom/xmldom`, `decode-uri-component`).  

---

## Implementation status

| # | Item | Status |
|---|------|--------|
| 1–6 | Auth, projects, deploys, logs, incident, env drift | Done |
| 7–10 | Domains, compare scoring, observability, firewall/flags | Done |
| 11–12 | Runtime log queries, READY poll | Done |
| 13–18 | N+1 fix + cache, `src/shell`, OAuth, ops brief, design, Maestro | Done |
| 19 | Native tabs + stacks + form sheets (Expo Router NativeTabs, iOS 26+ Liquid Glass) | Done (dev client / `npm run ios`) |
| 24 | Console content type (mono data, StateWord, grouped lists, optional texture) | Done |
| 20 | FlashList deploys, filters, detail sheet, recent-failure attention | Done |
| 31 | Deploy detail panes (Logs / Diagnose / Compare / Errors) | Done |
| 21 | On-device Apple Intelligence / Gemini Nano synthesizer | Done (hybrid fallback) |
| 25 | Search tab = OS on-device LLM (`generateObject`); hidden without Apple Intelligence / Gemini Nano | Done |
| 26 | Search results = in-place summary + reused ops widgets (no tab hops) | Done |
| 27 | Site scope in the nav title + picker (no empty Deploys without a way to pick) | Done |
| 22 | Android Material You accent, glass sheets, FAB menu | Done |
| 28 | iOS iron-black canvas + copper accent (rack Home: face, stamp, Diagnose) | Done |
| 29 | Deployment URL preview thumbs on Home, Deploys, and deploy detail | Done (WebView page snapshot, reserved portrait slot) |
| 23 | UIScene lifecycle (Expo SDK 58 `ExpoAppSceneDelegate`; required by iOS 27 SDK) | Done |
| 32 | App Intents / Siri AI shortcuts (open-only; no SiriKit entitlement) | Done |
| 30 | Env-gated demo fixtures for App Store screenshots (`EXPO_PUBLIC_TAKT_DEMO_MODE`) | Done (off by default; local screenshot builds only) |

More detail: [`docs/product-direction.md`](docs/product-direction.md), [`docs/implementation-notes.md`](docs/implementation-notes.md), [`docs/app-store-metadata.md`](docs/app-store-metadata.md).

---

## Privacy, security, and contributing

- [Privacy and local data retention](PRIVACY.md)
- [Security policy and private reporting](SECURITY.md)
- [Contribution guide](CONTRIBUTING.md)
- [Agent architecture rules](AGENTS.md)

---

## License

[MIT](LICENSE).
