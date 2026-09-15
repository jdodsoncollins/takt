import type { DataAvailability } from '../models/vercelModels';
import { availabilityLabel } from './dataAvailability';

/** Flag metadata only — no secret payloads. */
export interface FeatureFlagMeta {
  id: string;
  slug: string;
  name: string;
  /** active / paused / archived when known */
  state: string;
  description?: string | null;
  environment?: string | null;
  updatedAt?: string | null;
}

export interface FeatureFlagsReport {
  availability: DataAvailability;
  flags: FeatureFlagMeta[];
  summary: string;
  bullets: string[];
  /** Creating/updating flags is high-risk; not executed in MVP. */
  mutationsAllowed: false;
  note?: string;
}

export function buildFeatureFlagsReport(input: {
  flags: FeatureFlagMeta[] | null;
  availability: DataAvailability;
  note?: string;
}): FeatureFlagsReport {
  if (input.availability !== 'ok' || input.flags == null) {
    return {
      availability: input.availability,
      flags: [],
      summary: `Flags: ${availabilityLabel(input.availability)}`,
      bullets: [
        input.note ??
          'Feature Flags API not available for this project, plan, or token scope.',
      ],
      mutationsAllowed: false,
      note: input.note,
    };
  }

  const flags = input.flags;
  const active = flags.filter((f) =>
    /active|enabled|on/i.test(f.state),
  ).length;
  const bullets = flags.slice(0, 12).map((f) => {
    const env = f.environment ? ` · ${f.environment}` : '';
    return `${f.slug || f.name} [${f.state}]${env}`;
  });
  if (flags.length > 12) {
    bullets.push(`…and ${flags.length - 12} more`);
  }

  return {
    availability: 'ok',
    flags,
    summary: `${flags.length} flag(s), ${active} active/enabled`,
    bullets:
      bullets.length > 0
        ? bullets
        : ['No flags returned (empty project configuration)'],
    mutationsAllowed: false,
  };
}
