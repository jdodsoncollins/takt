import type { DataAvailability } from '../models/vercelModels';
import { availabilityLabel } from './dataAvailability';

export interface FirewallPeriodStats {
  allowed: number;
  denied: number;
  challenged: number;
  /** Optional concentration hints from API when present (no PII dump). */
  topDeniedRoute?: string | null;
  topCountry?: string | null;
  topRule?: string | null;
}

export interface FirewallExplanation {
  availability: DataAvailability;
  headline: string;
  bullets: string[];
  changeFromPrevious: string | null;
  suggestedAction: string | null;
  /** Mutations always require hard confirm — Taktung is read-only for firewall MVP. */
  mutationsAllowed: false;
  note?: string;
}

export function explainFirewall(input: {
  current: FirewallPeriodStats | null;
  previous: FirewallPeriodStats | null;
  availability: DataAvailability;
  note?: string;
}): FirewallExplanation {
  if (input.availability !== 'ok' || !input.current) {
    return {
      availability: input.availability,
      headline: `Firewall: ${availabilityLabel(input.availability)}`,
      bullets: [
        input.note ??
          'Firewall traffic totals are not available for this project or token scope.',
        'Taktung does not invent Allowed / Denied / Challenged counts.',
      ],
      changeFromPrevious: null,
      suggestedAction:
        input.availability === 'not_enabled'
          ? 'Enable Vercel Firewall / WAF in project security settings if desired.'
          : 'Retry later or open Security in the Vercel dashboard.',
      mutationsAllowed: false,
      note: input.note,
    };
  }

  const c = input.current;
  const total = c.allowed + c.denied + c.challenged;
  const bullets: string[] = [
    `Allowed: ${c.allowed}`,
    `Denied: ${c.denied}`,
    `Challenged: ${c.challenged}`,
  ];
  if (total > 0) {
    const denyPct = ((c.denied / total) * 100).toFixed(1);
    bullets.push(`Deny share: ${denyPct}% of observed actions`);
  }
  if (c.topDeniedRoute) {
    bullets.push(`Top denied route: ${c.topDeniedRoute}`);
  }
  if (c.topCountry) {
    bullets.push(`Top country (denied concentration): ${c.topCountry}`);
  }
  if (c.topRule) {
    bullets.push(`Most active rule: ${c.topRule}`);
  }

  let changeFromPrevious: string | null = null;
  if (input.previous) {
    const p = input.previous;
    const dDelta = c.denied - p.denied;
    const aDelta = c.allowed - p.allowed;
    changeFromPrevious = `vs previous period: denied ${fmtDelta(dDelta)}, allowed ${fmtDelta(aDelta)}`;
    bullets.push(changeFromPrevious);
  }

  let suggestedAction: string | null = null;
  let headline = 'Firewall: within normal range';
  if (total > 0 && c.denied / total > 0.35) {
    headline = 'Firewall: elevated denials';
    suggestedAction =
      'Review whether a rule is too aggressive (false positives). Rule changes require hard confirmation and are not executed from Taktung yet.';
  } else if (c.challenged > c.denied && c.challenged > 100) {
    headline = 'Firewall: elevated challenges';
    suggestedAction =
      'Check challenge rate by route; consider tightening only after confirming bot traffic.';
  }

  return {
    availability: 'ok',
    headline,
    bullets,
    changeFromPrevious,
    suggestedAction,
    mutationsAllowed: false,
  };
}

function fmtDelta(n: number): string {
  if (n === 0) return '±0';
  return n > 0 ? `+${n}` : String(n);
}
