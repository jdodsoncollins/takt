import { cryptoRandomId } from '../domain/actions/taktAction';
import type { ActivityItem } from '../domain/models/vercelModels';

export function activity(
  kind: ActivityItem['kind'],
  title: string,
  detail: string,
  outcome: ActivityItem['outcome'],
  extra?: Partial<ActivityItem>,
): ActivityItem {
  return {
    id: cryptoRandomId(),
    kind,
    title,
    detail,
    outcome,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}
