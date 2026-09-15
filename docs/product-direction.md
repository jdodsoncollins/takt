# Taktung product direction

## Promise

Local-first Vercel **incident, deployment, and configuration intelligence** — not mobile CRUD for the whole dashboard.

## Architecture

```text
Vercel adapter → normalized resources → typed action plans
  → local analysis → review/diff UI → confirmed execution → activity
```

## Implementation status

| # | Item | Status |
|---|------|--------|
| 1 | Token auth (SecureStore) | Done |
| 2 | Projects + attention health | Done |
| 3 | Deployments list | Done |
| 4 | Detail + logs + hard-confirm mutators | Done |
| 5 | Local incident summary | Done |
| 6 | Env drift (names only) | Done |
| 7 | Domain diagnostics (verify / DNS / SSL signals) | Done |
| 8 | Deployment compare + risk/similarity scoring UI | Done |
| 9 | Observability with honest empty states | Done |
| 10 | Firewall explain + Flags metadata (read-only) | Done |

## Safety

- No env values to model or UI
- Allow-listed actions only
- Hard confirm for redeploy / promote / rollback
- Domain, firewall, and flag **mutations** not executed from Taktung (read-only diagnostics; product requires hard confirm if added later)
- Activity records real outcomes
- Metrics never shown as bare dashes — use availability labels

## Beyond original 1–10

| Item | Status |
|------|--------|
| Runtime log queries (validated filters) | Done |
| Poll BUILDING → READY after mutators | Done |
| N+1 project list fix + cache | Done |
| Rename shell (`src/shell`) | Done |
| OAuth PKCE (+ PAT fallback) | Done |
| Bounded local ops brief | Done |
| READY poll progress UX | Done |
| Runtime log normalizer fixtures | Done |
| Maestro smoke skeleton | Done |
| Liquid Glass / M3 design pass | Done (tokens + chrome) |
| Warm dark canvas + peach accent (iOS) | Superseded by copper rack |
| Copper rack Home (face + stamp + Diagnose) | Done (iOS copper `#C4784A`, mint READY) |
| Native tabs + console content type | Done (NativeTabs, StateWord, optional texture) |
| Native UIGlassEffect chrome (`expo-glass-effect`) | Done (iOS 26+; BlurView / opaque fallbacks) |
| Virtualized deploys + filters + detail sheet | Done |
| Recent-failure attention | Done (after deploy list load; no list N+1) |
| Per-action busy / pull-to-refresh / team chips | Done |
| iOS assistant island + Android FAB | Done |
| Heuristic ops synthesizer seam | Done |
| On-device Apple FM / Gemini Nano + hybrid fallback | Done (`expo-ai-kit`, heuristic if unavailable) |
| Search = on-device LLM, hidden without OS model | Done (Apple Intelligence / Gemini Nano only) |
| Search results = in-place summary + reused ops widgets | Done (no tab hops) |
| Site scope in the navigation title | Done (picker sheet; project labeled as site) |
| Android Material You accent (`PlatformColor`) | Done (minSdk 35) |
| Glass sheets (`GlassSheetFrame`) | Done |
| Android FAB menu | Done |
| OAuth refresh-token rotation | Done (unit-tested; live Vercel app still needs client id) |
| Richer site rows (domain · repo · commit) | Done (commit line includes short SHA) |
| Inspect hosts (alias classify) | Done |
| Functions inventory + honest empty | Done |
| Deployment URL preview thumbs (Home + Deploys + detail) | Done (WebView page snapshot, reserved portrait slot, no list N+1) |
| Deploy detail panes (Logs / Diagnose / Compare / Errors) | Done (one selected pane; mutators stay actions) |

## Suggested next

1. **Expo Router native tabs** — blocked: shell stays in `src/shell` (Expo Router collision)
2. **Apple Private Cloud Compute** as a second hop (API not wired; hybrid today is on-device → heuristic)
3. **Shared control-plane package** with Mobileflow when both stabilize
4. **Device Maestro** against a signed-in native build
5. Register a Vercel OAuth app so refresh runs in production, not only tests
