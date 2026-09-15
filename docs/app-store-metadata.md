# App Store Connect copy (en-US)

Paste-ready fields for Taktung. Character limits are Apple’s. Do not invent user counts, ratings, or a public waitlist.

Name and subtitle are indexed. The description is not. Keywords are hidden; they must not repeat words already in the name or subtitle.

---

## Name

```
Taktung
```

7 / 30 characters.

Keep the German word as the product name. Do not append “App”. Takt is already used by other App Store apps.

## Subtitle

```
Vercel deploy and incident ops
```

30 / 30 characters.

## Promo text (optional, 170)

Shows above the description. You can change this without a new binary.

```
Pick a Vercel site. See production health and failures. Confirm before you redeploy, promote, or roll back.
```

107 / 170 characters.

## Description

4000 character max. First three lines show before “more”.

```
Taktung (German: putting work on a beat) puts Vercel production on your phone. Pick a site. You get health, the latest deploy, and whether something failed.

Redeploy, promote, or roll back only after you confirm. Activity records READY after Taktung polls Vercel.

Sign in with Vercel OAuth or a personal access token. Credentials stay in iOS Secure Store. The phone calls api.vercel.com directly.

On each tab the header is the selected site. You can switch sites without leaving Deploys, Activity, or Search.

You can:
• Read a site briefing and run Diagnose
• Browse deploys, build logs, and a compare of two deploys
• See env drift by name and target (values never appear)
• Check domain, DNS, and SSL signals
• Read firewall and flag metadata (read-only)
• Filter production logs (for example 5xx since this morning)
• Search with Apple Intelligence on devices that have it. The Search tab hides when the OS model is missing.

Requires iOS 26.4 or later. iPad is supported.
```

987 / 4000 characters.

## Keywords (hidden, 100)

Comma-separated, no spaces after commas, no words from name or subtitle (`taktung`, `vercel`, `deploy`, `incident`, `ops`).

```
production,rollback,preview,dns,ssl,logs,build,promote,site,serverless,cdn,health,monitor,fail,takt
```

99 / 100 characters.

## What’s New (version 1.1.2)

```
Copper rack Home. Deploy detail treats Logs, Diagnose, Compare, and Errors as panes — only the selected one is on screen.
```

## What’s New (version 1.1.1)

```
Search results stay in place when a site changes. Fewer refresh glitches on Home and Deploys.
```

## What’s New (version 1.1.0)

```
Live page snapshots on Home, Deploys, and each deploy’s detail sheet — the painted site, not a logo.
```

## What’s New (version 1.0.1)

```
Warm dark canvas and a peach accent. Inspect assigned hosts and functions from a deployment. Site rows show domain, git repo, and last commit.
```

## What’s New (version 1.0.0)

```
First App Store build.

Site-scoped Home, Deploys, and Activity. Hard confirm for redeploy, promote, and rollback. READY is recorded only after Vercel says so. Search uses Apple Intelligence when the device has it.
```

## Categories

- Primary: Developer Tools
- Secondary: Productivity

## URLs

App Store Connect requires a privacy policy URL and a support URL.

| Field | URL | Status |
|---|---|---|
| Privacy policy | `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Required for store listing |
| Support | `EXPO_PUBLIC_SUPPORT_URL` | Required for store listing |
| Marketing (optional) | your marketing site | Optional |

## Copyright

```
2026 Jeremy Collins
```

## Bundle / version

| Field | Value |
|---|---|
| Bundle ID | `EXPO_PUBLIC_BUNDLE_ID` |
| SKU | `takt` |
| Version | from `app.config.ts` |
| Build | autoIncrement on EAS production |
| Apple team | `EXPO_PUBLIC_APPLE_TEAM_ID` |
| Devices | iPhone and iPad, portrait |
| Minimum iOS | 26.4 |

---

## Age rating

Answer the questionnaire as written. Suggested results for this binary:

| Question | Answer |
|---|---|
| Alcohol, tobacco, or drugs | None |
| Contests | None |
| Gambling | No |
| Simulated gambling | None |
| Horror / fear | None |
| Mature / suggestive | None |
| Medical or treatment | None |
| Profanity or crude humor | None |
| Sexual content | None |
| Unrestricted web access | No (OAuth uses Safari for Vercel login only) |
| Cartoon violence | None |
| Realistic violence | None |
| 17+ | No |

Expected rating: **4+**.

## App Privacy (nutrition label)

Taktung does not run analytics, ads, crash reporters, or its own backend.

Data the **developer** collects: none.

Data the app sends **to Vercel** after the user signs in (Vercel’s privacy policy applies):

- Account and team identifiers
- Project, deployment, domain, and log metadata the user requested
- The access token, as the `Authorization` header to `api.vercel.com`

Not collected, not displayed, not cached: environment variable **values**.

Linked to identity: yes, via the Vercel account the user signed in with. Used for tracking: no.

Account deletion: Taktung does not create Taktung accounts. Settings → Disconnect and erase local data removes the token, site selection, snapshots, and Activity from the device.

## Export compliance

Uses HTTPS to `api.vercel.com`. Standard encryption only.

In App Store Connect: **Yes**, uses encryption, **exempt** (HTTPS). `app.config.ts` sets `ios.config.usesNonExemptEncryption` to `false`, which writes `ITSAppUsesNonExemptEncryption` into Info.plist on prebuild.

## Content rights

You own the Taktung name, icon, and screenshots. Third-party marks (Vercel) appear as the service the user already has. No third-party audio, video, or licensed fonts beyond system type.

---

## Review notes

App Review will not have your Vercel projects unless you give them a way in. Do **not** paste a personal access token into this file, git, or a screenshot.

### Contact (fill before submit)

- Name and contact from your App Store Connect account
- Phone: E.164, with country code

### Demo access

1. Open Settings.
2. Paste the review-only Vercel token into Personal access token and tap Update token.
3. If prompted, pick the team that owns the demo projects.
4. On Home, tap Choose a site and select a project.

Create a **throwaway Vercel token** with read access to a small team that has at least one production deploy and one failed deploy. Put that token only in the App Review “Sign-in required” fields, then revoke it after approval.

OAuth is optional for review. The Vercel app client id is not set in this build, so PAT is the path reviewers can finish.

### What to try

- Home: live face, stamp (PROD / GIT / AGE), Diagnose.
- Deploys: list, open a row, read logs. Redeploy / promote / rollback show a confirmation sheet. Cancel is enough; they do not need to mutate production.
- Activity: success and failure lines. READY appears only after a poll.
- Settings: Disconnect and erase local data.

### What they should not see

- Environment variable values
- A Taktung username/password (there isn’t one)
- A working Search tab on a Simulator without Apple Intelligence (the tab hides)
- A microphone, Face ID, or SiriKit permission prompt. Speech and Face ID are not used. App Shortcuts use App Intents without the SiriKit entitlement.

### Hardware / OS

iPhone or iPad, iOS 26.4 or later. iOS 27 is fine. A Simulator without Apple Intelligence will hide Search; that is expected.

---

## Screenshots to upload

Apple wants the 6.9" iPhone set and the 13" iPad set. JPEG/PNG, no alpha. One to ten per size. Portrait.

Suggested order (5):

| # | File | Caption idea (optional, 170 chars) |
|---|---|---|
| 1 | `01-home.png` | Selected site, live face, stamp, Diagnose |
| 2 | `02-deploys.png` | Live deploy list with READY / ERROR |
| 3 | `03-activity.png` | Audit trail. READY only after Vercel confirms |
| 4 | `04-search.png` | On-device Search. Results stay on this tab |
| 5 | `05-settings.png` | Token stays on device. Disconnect wipes local data |

Folders:

- iPhone 6.9": `iphone-6.9-1320x2868/` (1320 × 2868)
- iPad 13": `ipad-13-2064x2752/` (2064 × 2752)

Capture from a **Release simulator** built with `EXPO_PUBLIC_TAKT_DEMO_MODE=1` so listing copy is generic (`example-portfolio.app`, `Update landing page layout`) in the same SF/Menlo faces as the shipping UI. Do not ship that flag in TestFlight. JPEG/PNG, no alpha.

Skip `00-choose-site.png` and `06-sites.png` if you want five tight frames. The 6.3" files in this directory (`01-home.png` at the root) are the older iPhone 17 Pro size. Do not upload those as the 6.9" set.

App preview video: skip for 1.0.0.

---

## Checklist before submit

- [ ] Privacy and support URLs load without login
- [ ] Review-only Vercel token created; not committed
- [ ] 6.9" iPhone and 13" iPad screenshots uploaded (no alpha)
- [ ] Age rating questionnaire matches the table above
- [ ] Privacy nutrition label: no developer-collected data; Vercel is the destination
- [ ] Export compliance: HTTPS exemption
- [x] `ITSAppUsesNonExemptEncryption = false` (`app.config.ts` `ios.config.usesNonExemptEncryption`)
- [ ] Build signed with `EXPO_PUBLIC_APPLE_TEAM_ID`
- [ ] Review notes explain PAT login and that Search may be hidden
- [ ] Revoke the review token after the app is approved
