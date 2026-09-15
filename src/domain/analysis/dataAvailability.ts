import type { DataAvailability, MetricSlot } from '../models/vercelModels';

/** Human label — never use bare "—" as a fake metric value. */
export function availabilityLabel(a: DataAvailability): string {
  switch (a) {
    case 'ok':
      return 'Available';
    case 'no_data':
      return 'No data';
    case 'unavailable_for_plan':
      return 'Unavailable on this plan';
    case 'not_enabled':
      return 'Not enabled';
    case 'temporarily_unavailable':
      return 'Temporarily unavailable';
  }
}

export function slotOk<T>(value: T, note?: string): MetricSlot<T> {
  return { availability: 'ok', value, note };
}

export function slotEmpty<T>(
  availability: Exclude<DataAvailability, 'ok'>,
  note: string,
): MetricSlot<T> {
  return { availability, value: null, note };
}

export function formatMetricSlot(
  label: string,
  slot: MetricSlot<string | number>,
): string {
  if (slot.availability !== 'ok' || slot.value == null) {
    return `${label}: ${availabilityLabel(slot.availability)}${
      slot.note ? ` — ${slot.note}` : ''
    }`;
  }
  return `${label}: ${slot.value}`;
}
