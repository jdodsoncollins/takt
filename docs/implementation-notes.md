# Implementation notes

## Authentication

Taktung supports OAuth authorization code flow with PKCE and PAT fallback through the API client's `tokenProvider`. OAuth account identity comes from the authenticated `/v2/user` request. Taktung does not decode or trust `id_token` claims. Credential generations prevent a delayed refresh from replacing a disconnect, erase, PAT replacement, or newer OAuth login.

## Env values

`listEnvVarMeta` maps API fields and **drops** `value` even if the API returns it. Drift analysis only sees keys + targets + type.

## Redeploy semantics

`redeploy` / promote / rollback create a **new** deployment via `POST /v13/deployments` with the source deployment id and confirmed project id in the documented `project` field. Activity says “accepted” with the new id and state; it does **not** claim READY until a later refresh shows READY.

## Local deletion

The snapshot store indexes each account and team cache key. Disconnect and erase use that index to remove snapshots from teams that are absent from the current Vercel team response, along with credentials, selections, and activity.

## Local incident summary

Deterministic heuristics (env missing, OOM, module not found, TS errors). Home **Diagnose** uses `synthesizeOpsNarrativeHybrid` (on-device then heuristic) and is hidden without the OS model. Search is a **results canvas**, not a launcher: typed queries go through `routeOpsQuery` + `expo-ai-kit.generateObject`, then render a summary plus reused ops widgets (`OpsSections`) in place. Missing project/deployment context swaps in picker widgets instead of switching tabs. Mutators are not in the Search catalog. No keyword fallback, no downloadable GGUF/LiteRT weights. Home is a copper rack: live production face, stamped PROD / GIT / AGE, metronome fill for age. Privacy line lives in Settings, not Home.

## Domains / observability / firewall / flags

Optional product surfaces use `requestSoft` so 402/403/404 map to `DataAvailability` instead of hard failures. UI uses `formatMetricSlot` / availability labels — never unexplained dashes.

Firewall and flag **mutations are not allow-listed**. Explain/list only.

Deployment compare adds `riskScore` / `similarityScore` / `riskLevel` and one-tap baseline via `pickBaselineDeployment`.

## Runtime logs + READY poll

- NL / assistant phrases map to `RuntimeLogQuery` only (`parseRuntimeLogQuery`).
- Client-side filter after soft API fetch; unavailable → honest availability.
- After redeploy/promote/rollback **accept**, Activity says “accepted / polling”; a second Activity line records READY or failure only after `pollDeploymentUntilTerminal`. Never claims READY from the mutator response alone.

## App icon

Shipping iOS icons are **raster appearances**, not a full-bleed Icon Composer `.icon`. Spotlight and the Home Screen search glyph need a flattened 60pt PNG; a `.icon` whose layers are 1024 full-bleed photographs with `fill: none` compiles to an empty/black tile there.

`ios.icon` is the Expo light / dark / tinted object:

- `assets/icon-light.png` — copper metronome on cream
- `assets/icon.png` — mint metronome on iron (also Android / web / splash source)
- `assets/icon-tinted.png` — white metronome template

EAS / `expo prebuild` writes `AppIcon.appiconset`. Layered `.icon` experiments stay under `assets/AppIcon*.icon` (pulse, T, metronome) but are not `ASSETCATALOG_COMPILER_APPICON_NAME`. Previews: `assets/icons/previews/`.

## Liquid Glass (iOS)

Navigation chrome is **system native**: Expo Router `NativeTabs` (`unstable-native-tabs`, SDK 58 `NativeTabs.Trigger.*` children) plus nested `Stack` (large titles, transparent headers) and `formSheet` for Settings and deployment detail. On iOS 26.4+ the tab bar is UIKit Liquid Glass (`UIGlassEffect`); iOS 27 keeps the same chrome with OS refinements. The assistant is a `role="search"` tab with a system search field, **omitted** unless `expo-ai-kit.isAvailable()` is true (Apple Intelligence or Gemini Nano). `/search` does not mount the Ask field or Command UI until that probe succeeds, then redirects Home when the model is missing. Search answers with summaries and widget snippets; it does not deep-link to Home / Deploys / Activity. Routes live in repo-root `app/` — not `src/app`. Product state stays in `src/shell`. Content is an ops console: SF/Menlo mono for IDs, slugs, states, timestamps, env **names**, and logs; system text for prose. `StateWord` replaces candy pills in lists. Do not set `UIDesignRequiresCompatibility`.

## Deployment git meta

List and detail map Vercel `meta` plus `source`, `creator.username`, `isRollbackCandidate`, and the first `regions` entry. Author emails from GitHub/Vercel payloads are dropped at the API mapper and never shown. Rows show `target · branch · short SHA · age`. Detail adds commit body, provenance (`git · @login · region`), and a rollback-candidate note when Vercel sets that flag.

## Deployment preview thumbs

Home, Deploys, and deploy detail show a reserved portrait miniature of the live READY URL (not `og:image` — many sites only publish a logo). Detail uses the same Home-sized slot so Logs / Diagnose / Compare / Errors fit on the first screen. Detail reuses the session capture cache from the list. Native captures one off-screen WebView at a time (`DeploymentPreviewCaptureHost`), sizes it to the document height (capped), and snapshots with `react-native-view-shot`. Vercel login/SSO locations are skipped. Web falls back to an HTML OG probe. Session-cached; list unmount does not abort an in-flight capture. Needs a dev client (webview + view-shot), not Expo Go.

## Deploy list + attention

**Site scope** is the selected Vercel project, labeled `primaryDomain` or name. A tappable navigation title on Home / Deploys / Activity / Search opens a form-sheet picker (attention first, no list N+1). Missing scope stays on-tab (“Choose a site”) instead of sending the user to Home. Activity defaults to this site with an optional All filter. Home with a site is that site’s briefing, not a portfolio launcher.

Home never N+1s `listDeployments`. After a project’s deploy list loads, Taktung recomputes `needsAttention` from that list so a READY production plus a later/other production ERROR is `recent_failure` (degraded, not all-clear). Filters (All / Failed / Building / Production) are pure (`filterDeployments`). Rows are virtualized with FlashList; detail lives in a sheet so the list stays compact. Logs / Diagnose / Compare / Errors are mutually exclusive panes (one selected result, not a stack). Redeploy / promote / rollback stay actions under the pane. The sheet is one ScrollView sized to the form-sheet layout height so content cannot overlay the chrome (which stole taps from Logs / Diagnose). Opening a deploy paints the list row immediately (then refreshes from `getDeployment`) so the sheet is never empty. On iPhone the card snaps to 50% and 100% (`sheetAllowedDetents: [0.5, 1]`); at 50% the list behind is undimmed for cross-compare.

## Ops synthesizer

`synthesizeOpsNarrativeHybrid` tries the OS built-in model first (`expo-ai-kit@0.17` with `{ "llm": true }`: Apple Foundation Models on iOS 26.4+, AFM 3 Core on iOS 27, ML Kit / Gemini Nano on Android 15+), then the heuristic planner. Output is schema-checked and rejected if it looks like a secret. Polling briefs stay heuristic. Native inference requires a dev client (`npm run ios` / `npm run android`), not Expo Go or web. Speech / vision / downloadable Gemma stay off so we do not request microphone or extra model weights.

Search does **not** use that hybrid fallback. `probeOnDeviceAvailable()` runs once during rehydrate (`kit.isAvailable()` only). `createOnDeviceBackend` calls `prepareBuiltInModel()` — the best OS-managed model on high-end latest-OS phones — and never `setModel` / downloadable Gemma. Simulator and web typically report unavailable; the Search tab stays hidden.

## Target OS

iOS deployment target **26.4**. Compile SDK is **iOS 27** (Xcode 27). Android **minSdk 35**. Liquid Glass (`UIGlassEffect`) and Apple Foundation Models are iOS 26 APIs; they already no-op when unavailable (`expo-glass-effect` availability + `expo-ai-kit.isAvailable()` hides Search). iOS 27 is an improvement, not the floor. Full iPhone Duo (vertical bars, reserved regions) needs the iOS 27.1 SDK later.

## UIScene lifecycle

Apps built with the iOS 27 SDK fail to launch unless they adopt UIScene (Apple TN3187). Expo SDK 58 prebuild emits `ExpoAppSceneDelegate` + `UIApplicationSceneManifest`.

## App Intents / Siri AI

SiriKit is deprecated. iOS 27 Siri AI discovers **App Intents** / App Shortcuts, not SiriKit extensions. `plugins/withAppIntents.js` injects open-only intents (Home, Deploys, Activity, Ask, Settings) that deep-link via `takt://…`. They never redeploy, promote, or rollback. Entitlements stay empty: App Shortcuts do **not** use `com.apple.developer.siri` (that key is for SiriKit Intents extensions). Do not add `NSMicrophoneUsageDescription`, `NSSiriUsageDescription`, Face ID, or side-button-access. `expo-secure-store` is configured with `faceIDPermission: false`.

## Entitlements

`Taktung.entitlements` is an empty dict on purpose. EAS enables Apple capabilities from this file; requesting SiriKit, Associated Domains, or App Groups without using them is a Review risk.

## TypeScript (SDK 58 / RN 0.87)

React Native 0.87 defaults to the Strict TypeScript API. Taktung opts out via `compilerOptions.customConditions: ["react-native", "react-native-legacy-deep-imports"]`. `tsconfig` extends `expo/tsconfig.base.json` so Vitest on TypeScript 6 can resolve it.

Debug on a physical phone does not embed JS. Run Metro (`npx expo start`) then build the **workspace** (`ios/Taktung.xcworkspace`) over USB so Xcode forwards `localhost:8081`. Without Metro you get `No script URL provided` / `unsanitizedScriptURLString = (null)`. To freeze JS into the binary, use a **Release** run (`npx expo run:ios --device --configuration Release`). `ios/` stays gitignored. Decline Xcode’s project-document upgrade — it breaks `pod install` until `npm run ios:pods` flattens `shellScript` arrays (CocoaPods/CocoaPods#12794).

## Demo mode (screenshots only)

**Off by default.** `EXPO_PUBLIC_TAKT_DEMO_MODE=1` inlines a compile-time flag (`src/support/demoMode.ts`). Unset, empty, and any value other than `1` / `true` / `yes` leave the live Vercel REST path unchanged. When on, `AppProvider` hydrates an in-memory `DemoVercelAPIClient` with generic sites (`example-portfolio.app`, `example-store.app`, …), generic commits, and no live URLs — so preview capture does not load real pages. Token persist, activity persist, and mutators stay off. Never set this in `eas.json` or on EAS production.

## Testing

Unit tests cover policy, drift, incident, health, compare scoring, domains, observability empty states, firewall explain, flags, runtime log parse/filter, deployment poll, executePlan gates, activity store, API client mapping, host classification, function inventory, and demo fixtures. Manual: `npm run typecheck`, `npm test`, `npm run export:web`.

## Inspect hosts and functions

Hosts are classified from aliases already returned by `getDeployment` — no extra request, and never from the deploys list. Custom domains (and listed production hosts) are **production**; `*.vercel.app` names with `-git-` are **branch**; the deploy URL / short id / commit sha token is **commit**; remaining `*.vercel.app` names are **aliases**.

Functions load `/v6/deployments/:id/files` only from the Functions sheet (one deployment at a time). A 404 is “not published”, not a hard failure. When the tree is unpublished, hashed `__fn_` outputs from v13 `lambdas` are shown with a note. Env **values** never appear. This is not a dashboard clone: no Billing, v0, Rate Limits, or Source/Output browsers.
