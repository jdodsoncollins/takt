import type { DataAvailability, MetricSlot } from '../models/vercelModels';
import { slotEmpty, slotOk } from './dataAvailability';

/**
 * Observability / analytics snapshot.
 * Values are only shown when availability is ok — never fake zeros or dashes.
 */
export interface ObservabilitySnapshot {
  periodLabel: string;
  pageviews: MetricSlot<number>;
  visitors: MetricSlot<number>;
  errorRate: MetricSlot<string>;
  p50LatencyMs: MetricSlot<number>;
  functionFailures: MetricSlot<number>;
  coldStarts: MetricSlot<number>;
  routeHealth: MetricSlot<string>;
  headline: string;
  bullets: string[];
}

export type ObservabilityFetchResult =
  | {
      kind: 'ok';
      pageviews?: number | null;
      visitors?: number | null;
      errorRatePct?: number | null;
      p50LatencyMs?: number | null;
      functionFailures?: number | null;
      coldStarts?: number | null;
      topErrorRoute?: string | null;
    }
  | { kind: 'not_enabled'; detail?: string }
  | { kind: 'unavailable_for_plan'; detail?: string }
  | { kind: 'temporarily_unavailable'; detail?: string }
  | { kind: 'no_data'; detail?: string };

export function buildObservabilitySnapshot(
  result: ObservabilityFetchResult,
  periodLabel = 'Last 24h',
): ObservabilitySnapshot {
  if (result.kind !== 'ok') {
    const a: Exclude<DataAvailability, 'ok'> = result.kind;
    const note =
      result.detail ??
      (result.kind === 'not_enabled'
        ? 'Enable Web Analytics / Observability in the Vercel project'
        : result.kind === 'unavailable_for_plan'
          ? 'This metric requires a plan or product entitlement not available here'
          : result.kind === 'no_data'
            ? 'No samples in the selected window'
            : 'Retry later');
    const empty = <T,>() => slotEmpty<T>(a, note);
    return {
      periodLabel,
      pageviews: empty(),
      visitors: empty(),
      errorRate: empty(),
      p50LatencyMs: empty(),
      functionFailures: empty(),
      coldStarts: empty(),
      routeHealth: empty(),
      headline: `Observability: ${note}`,
      bullets: [
        `Status: ${a}`,
        'Taktung will not invent metrics or show unexplained dashes.',
      ],
    };
  }

  const pageviews =
    result.pageviews != null
      ? slotOk(result.pageviews)
      : slotEmpty<number>('no_data', 'Pageviews not returned');
  const visitors =
    result.visitors != null
      ? slotOk(result.visitors)
      : slotEmpty<number>('no_data', 'Visitors not returned');
  const errorRate =
    result.errorRatePct != null
      ? slotOk(`${result.errorRatePct.toFixed(2)}%`)
      : slotEmpty<string>('no_data', 'Error rate not returned');
  const p50LatencyMs =
    result.p50LatencyMs != null
      ? slotOk(result.p50LatencyMs)
      : slotEmpty<number>('no_data', 'Latency not returned');
  const functionFailures =
    result.functionFailures != null
      ? slotOk(result.functionFailures)
      : slotEmpty<number>('no_data', 'Function failure count not returned');
  const coldStarts =
    result.coldStarts != null
      ? slotOk(result.coldStarts)
      : slotEmpty<number>('no_data', 'Cold start count not returned');
  const routeHealth =
    result.topErrorRoute != null
      ? slotOk(result.topErrorRoute, 'Highest-error route when available')
      : slotEmpty<string>('no_data', 'No route-level error breakdown');

  const bullets: string[] = [];
  if (pageviews.availability === 'ok') {
    bullets.push(`Pageviews: ${pageviews.value}`);
  }
  if (visitors.availability === 'ok') {
    bullets.push(`Visitors: ${visitors.value}`);
  }
  if (errorRate.availability === 'ok') {
    bullets.push(`Error rate: ${errorRate.value}`);
  }
  if (p50LatencyMs.availability === 'ok') {
    bullets.push(`p50 latency: ${p50LatencyMs.value} ms`);
  }
  if (bullets.length === 0) {
    bullets.push('API responded but no metric fields were populated');
  }

  return {
    periodLabel,
    pageviews,
    visitors,
    errorRate,
    p50LatencyMs,
    functionFailures,
    coldStarts,
    routeHealth,
    headline: 'Observability snapshot',
    bullets,
  };
}
