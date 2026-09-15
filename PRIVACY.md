# Privacy

Taktung connects your device to the Vercel API. Taktung does not operate an intermediary server and does not include analytics, advertising, crash reporting, or telemetry SDKs.

## Data Taktung handles

- Vercel OAuth credentials or a personal access token
- Vercel account, team, project, deployment, domain, log, and operational metadata requested in the app
- Project snapshots used for the local cache, plus an index of snapshot storage keys used for complete deletion
- Up to 100 local activity metadata entries

Taktung excludes environment variable values from its UI, cache, activity history, and operations briefs.

## Storage and retention

On iOS and Android, Taktung stores credentials in the platform Secure Store. Taktung stores project snapshots, selections, and activity metadata in local app storage. Project snapshots remain until Taktung replaces them or you disconnect. Activity metadata remains until the 100-entry limit replaces older entries, you clear Activity, or you disconnect. Android app backup is disabled. iOS and platform-managed device backups may include local operational metadata.

Disconnecting removes credentials, account selections, project snapshots, and activity metadata from the device. Uninstalling removes app storage, but Secure Store retention varies by platform. On the web, Taktung keeps credentials in memory for the current session and does not persist them.

## Network requests

Taktung sends credentials and requested operations directly to Vercel. Vercel processes that data under its own privacy terms. OAuth uses the system browser and the configured `{scheme}://oauth/callback` redirect.

## Contact

Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` for the in-app Privacy Policy link. Open a private security advisory in this repository for security or privacy reports. See [SECURITY.md](SECURITY.md).
