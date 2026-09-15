# Design constraints

Product: Taktung
Date: 2026-09-08
Direction: C Copper rack (seed `de50fe…68e6`)

## Jobs

- Primary: show the selected site’s production face and whether it is healthy, in one glance.
- Secondary: run Diagnose (on-device brief) when the OS model is available.
- Non-goals: dashboard clone, env values, restyling native tabs.

## Required states

- Empty: pick a site.
- Loading / cache: existing banners.
- Error: existing alert banner.
- Success: ALL CLEAR · READY, live face, stamp (PROD / GIT / AGE).

## Platform

- iOS HIG + Liquid Glass chrome only. Content opaque.
- Native tabs. Form sheets for Settings, site picker, deploy detail.
- Native chrome we will not restyle: tab bar, stack title container, form sheets.

## Type and spacing

- Menlo for IDs, slugs, states, timestamps, the nav site title.
- System text for prose (brief body).
- 8pt grid. Plates 6pt. Diagnose 4pt. Chrome capsules stay pill.

## Color

- iOS accent copper `#C4784A`. READY mint `#7CDECC`. Iron canvas `#0C0908`.
- Android keeps Material You accent.
- One accent. Neutrals carry the app.

## Performance and implementation

- Must not: N+1 `listDeployments` from Home; env values; glass on content.
- Must: reserved preview slot (no layout shift); FlashList on Deploys; Diagnose only when the OS model is available.

## References

- Flows of: industrial panel / ATC strip.
- Design of: seed string Fe / copper / mint / 50-split.
- Screenshots: `docs/design-pass/index.html` option C.

## What must not exist

- Repeated domain (title is the site).
- “Production health: Healthy” next to HEALTHY.
- Ghost “View deployments” (the Deploys tab).
- Privacy footnote on Home (Settings).
- Glow, extra labels, candy pills for state.
- Stacked Diagnose / Compare / Logs / Errors results on deploy detail (those are panes).
