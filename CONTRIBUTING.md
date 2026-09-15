# Contributing

## Setup

```bash
cp .env.example .env
npm ci
npm run doctor
npm run typecheck
npm test
```

Use Node.js 20.19+ or 22 LTS. Native work uses a development build, not Expo Go.

## Pull requests

- Keep Vercel resource IDs and environment values out of fixtures, screenshots, logs, and commits.
- Preserve hard confirmation for redeploy, promote, and rollback actions.
- Keep API, auth, storage, and domain changes covered by focused tests.
- Run `npm run audit`, both prebuild scripts, and the affected exports before requesting review.
- Explain user-visible behavior and any physical-device checks in the pull request.

Read [AGENTS.md](AGENTS.md) for architecture constraints. Report vulnerabilities through [SECURITY.md](SECURITY.md), not a pull request.

## License

By contributing, you agree that the project may distribute your contribution under the [MIT License](LICENSE).
