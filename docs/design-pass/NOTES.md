# Taktung design pass — 2026-09-08

Appllama MCP was not connected in this session. References are named products and the shipping screens (`store/screenshots/iphone-6.9-*`).

## Constraints (unchanged)

- Job: local-first Vercel ops assistant. Not a dashboard clone.
- Site scope = selected project. Title is the site.
- Env **values** never appear.
- Liquid Glass on navigation chrome only. Content is opaque.
- Native tabs. Settings / site picker / deploy detail are form sheets.
- Console type (Menlo) for IDs, slugs, states, timestamps. System text for prose.
- `StateWord` for READY / ERROR / ALL CLEAR. No candy pills for state.
- Honest empty and availability. Never a bare dash.
- Search exists only when the OS model is available.
- Mutators need hard confirm. READY only after Vercel says so.
- One accent. Warm black canvas. Not a Vercel brand copy.

## What the current Home fails

The title already names the site. The card names it again, then a grey phone, then the git line, then READY and HEALTHY, then “Production health: Healthy”, then four bullets that repeat READY / SHA / domain. “View deployments” duplicates the Deploys tab. The privacy line explains Search on a screen that is not Search.

Kill: repeated domain, “Production health: Healthy”, the ghost Deploys button, the privacy footnote (belongs in Settings). Elevate: one state word, the live face, the git line, one next action when something is wrong.

## Three directions

| | A Cautious | B Daring | C Seed |
| --- | --- | --- | --- |
| Idea | Cut the card into Settings groups | The live site *is* Home | Copper rack, 50/50 face + stamp |
| Flows of | iOS Settings | TestFlight (build over the running app) | Industrial panel / ATC strip |
| Design of | Shipping Taktung | Console.app HUD on a live canvas | Seed `de50fe…68e6` (Fe, copper, mint, 50) |
| Accent | Peach `#E8B4A0` | Phosphor `#7CFFB2` only | Copper `#C4784A`, mint READY |
| What you feel | Quieter same app | The site is the product | A tool you would keep on a bench |

C is the one I would take from the random set: still an ops tool, still one grid of meaning, but the metal/split/metronome came from outside the model instead of “make Home nicer.”

**Chosen: C.** Implemented in Home (`SiteRack`), copper tokens, Diagnose, privacy note moved to Settings. Constraints: [`docs/design-constraints.md`](../design-constraints.md).
