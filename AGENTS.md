# Taktung agent notes

- Shell lives in `src/shell` (not `src/app` — Expo Router collision). Routes live in repo-root `app/` with NativeTabs.
- Site scope = selected project (header title). Do not N+1 `listDeployments` from the site picker.
- Live Vercel REST API only for product data — no fake “demo projects” in the live path.
- Project list must not N+1 `listDeployments` (use embedded targets / latestDeployments).
- Env variable **values** must never appear in UI, activity, or brief context.
- Mutating actions: allow-list + ConfirmationPolicy + hard confirm; READY only after poll.
- Liquid Glass on navigation chrome only; content = opaque M3/HIG surfaces.
- Prefer unit tests for domain/analysis and API mapping when changing behavior.
- Identity (bundle ID, Apple team, EAS, OAuth client, privacy URL) comes from `.env`. Do not hard-code maintainer accounts.
- Decline Xcode’s project-document upgrade (it breaks `pod install`). If pods fail with `got Array for attribute shellScript`, run `npm run ios:pods` from the repo root.
- Update `README.md` and `docs/` when revising architecture.

## asc cli

See `ASC.md` for the command catalog. App Store Connect IDs are not in this repo; load them from `.env`.
