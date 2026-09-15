import { StyleSheet, Text, View } from 'react-native';
import {
  ContentCard,
  FilterChip,
  PrimaryButton,
  SectionLabel,
} from '../../design-system/GlassChrome';
import {
  DataText,
  GroupedList,
  GroupedRow,
  OutcomeWord,
  StateWord,
} from '../../design-system/ConsoleType';
import { colors, spacing, typography } from '../../design-system/theme';
import {
  availabilityLabel,
  formatMetricSlot,
} from '../../domain/analysis/dataAvailability';
import {
  describeSynthesizer,
  isOnDeviceSynthesizer,
} from '../../services/ai/onDeviceModel';
import { DeploymentRow } from '../deployments/DeploymentRow';
import { SiteRow } from '../sites/SiteRow';
import type { OpsNarrative } from '../../domain/analysis/opsNarrative';
import type { EnvDriftReport } from '../../domain/analysis/envDrift';
import type { DomainDiagnosticsReport } from '../../domain/analysis/domainDiagnostics';
import type { ObservabilitySnapshot } from '../../domain/analysis/observability';
import type { FirewallExplanation } from '../../domain/analysis/firewallExplain';
import type { FeatureFlagsReport } from '../../domain/analysis/featureFlags';
import type { RuntimeLogReport } from '../../domain/analysis/runtimeLogs';
import type { IncidentSummary } from '../../domain/analysis/incidentSummary';
import type { DeploymentDiff } from '../../domain/analysis/deploymentCompare';
import type {
  ActivityItem,
  MetricSlot,
  VercelConnection,
  VercelDeploymentSummary,
  VercelProject,
} from '../../domain/models/vercelModels';
import { connectionIsConnected } from '../../domain/models/vercelModels';
import type { DeploymentID, ProjectID, TeamID } from '../../domain/models/ids';

function MetricLine({
  label,
  slot,
}: {
  label: string;
  slot: MetricSlot<string | number>;
}) {
  const text = formatMetricSlot(label, slot);
  const muted = slot.availability !== 'ok';
  return (
    <Text style={[styles.finding, muted && styles.muted]}>{text}</Text>
  );
}

export function SearchSummarySection({
  reason,
  answer,
  nextSteps,
}: {
  reason?: string | null;
  answer?: string | null;
  nextSteps?: string[];
}) {
  if (!reason && !answer && !nextSteps?.length) return null;
  return (
    <ContentCard>
      <SectionLabel>Summary</SectionLabel>
      {reason ? <DataText>{reason}</DataText> : null}
      {answer ? <Text style={styles.body}>{answer}</Text> : null}
      {nextSteps?.map((step) => (
        <DataText key={step}>→ {step}</DataText>
      ))}
    </ContentCard>
  );
}

export function OpsBriefSection({ narrative }: { narrative: OpsNarrative | null }) {
  if (!narrative) {
    return (
      <ContentCard>
        <SectionLabel>Brief</SectionLabel>
        <Text style={styles.sub}>No issues check yet.</Text>
      </ContentCard>
    );
  }
  return (
    <ContentCard>
      <SectionLabel>Brief</SectionLabel>
      {isOnDeviceSynthesizer(narrative.source) ? (
        <Text style={styles.caption}>
          Source: {describeSynthesizer(narrative.source)}
        </Text>
      ) : null}
      <Text style={styles.headline}>{narrative.headline}</Text>
      <Text style={styles.sub}>{narrative.body}</Text>
      {narrative.nextSteps.map((s, i) => (
        <Text key={s} style={styles.caption}>
          {i + 1}. {s}
        </Text>
      ))}
    </ContentCard>
  );
}

export function AccountSection({
  connection,
  isRehydrating,
  onOpenSettings,
  onSelectTeam,
}: {
  connection: VercelConnection;
  isRehydrating?: boolean;
  onOpenSettings?: () => void;
  onSelectTeam?: (teamId: TeamID | null) => void;
}) {
  const connected = connectionIsConnected(connection);
  if (!connected) {
    return (
      <ContentCard>
        <SectionLabel>Connect</SectionLabel>
        <Text style={styles.body}>
          Add a Vercel token to load live projects. Tokens stay on-device in
          Secure Store (native). Taktung never invents deployment IDs.
        </Text>
        {onOpenSettings ? (
          <PrimaryButton
            title={isRehydrating ? 'Restoring…' : 'Open Settings'}
            onPress={onOpenSettings}
            disabled={isRehydrating}
          />
        ) : null}
      </ContentCard>
    );
  }
  return (
    <ContentCard>
      <SectionLabel>Account</SectionLabel>
      <Text style={styles.headline}>
        {connection.user?.name ?? connection.user?.username}
      </Text>
      <DataText>
        @{connection.user?.username}
        {connection.selectedTeamId
          ? ` · ${
              connection.teams.find((t) => t.id === connection.selectedTeamId)
                ?.slug ?? connection.selectedTeamId
            }`
          : ' · personal'}
      </DataText>
      {onSelectTeam && connection.teams.length > 0 ? (
        <View style={styles.wrap}>
          <FilterChip
            label="Personal"
            selected={connection.selectedTeamId == null}
            onPress={() => onSelectTeam(null)}
          />
          {connection.teams.map((t) => (
            <FilterChip
              key={t.id}
              label={t.slug}
              selected={connection.selectedTeamId === t.id}
              onPress={() => onSelectTeam(t.id)}
            />
          ))}
        </View>
      ) : null}
    </ContentCard>
  );
}

export function ProjectListSection({
  projects,
  onSelect,
  empty,
  limit,
  sectionLabel = 'Projects',
}: {
  projects: VercelProject[];
  onSelect?: (id: ProjectID) => void;
  empty?: string;
  limit?: number;
  sectionLabel?: string;
}) {
  const rows = limit != null ? projects.slice(0, limit) : projects;
  if (rows.length === 0) {
    return (
      <ContentCard>
        <SectionLabel>{sectionLabel}</SectionLabel>
        <Text style={styles.sub}>{empty ?? 'No projects found for this team.'}</Text>
      </ContentCard>
    );
  }
  return (
    <View>
      <SectionLabel>{sectionLabel}</SectionLabel>
      <GroupedList>
        {rows.map((p, i) => (
          <SiteRow
            key={p.id}
            project={p}
            last={i === rows.length - 1}
            onPress={onSelect ? () => onSelect(p.id) : undefined}
            accessibilityHint={onSelect ? 'Selects this site' : undefined}
          />
        ))}
      </GroupedList>
    </View>
  );
}

export function DeploymentListSection({
  deployments,
  selectedId,
  onSelect,
  empty,
  limit,
  selectsOnly = true,
}: {
  deployments: VercelDeploymentSummary[];
  selectedId?: string | null;
  onSelect?: (id: DeploymentID) => void;
  empty?: string;
  limit?: number;
  selectsOnly?: boolean;
}) {
  const rows = limit != null ? deployments.slice(0, limit) : deployments;
  if (rows.length === 0) {
    return (
      <ContentCard>
        <SectionLabel>Deployments</SectionLabel>
        <Text style={styles.sub}>{empty ?? 'No deployments loaded.'}</Text>
      </ContentCard>
    );
  }
  return (
    <View>
      <SectionLabel>Deployments</SectionLabel>
      <GroupedList>
        {rows.map((item, index) => (
          <DeploymentRow
            key={item.id}
            deployment={item}
            selected={selectedId === item.id}
            last={index === rows.length - 1}
            onPress={onSelect ?? (() => undefined)}
            selectsOnly={selectsOnly}
          />
        ))}
      </GroupedList>
    </View>
  );
}

export function ActivityListSection({
  items,
  limit,
}: {
  items: ActivityItem[];
  limit?: number;
}) {
  const rows = limit != null ? items.slice(0, limit) : items;
  if (rows.length === 0) {
    return (
      <ContentCard>
        <SectionLabel>Activity</SectionLabel>
        <Text style={styles.sub}>No activity yet.</Text>
      </ContentCard>
    );
  }
  return (
    <View>
      <SectionLabel>Recent</SectionLabel>
      <GroupedList>
        {rows.map((item, i) => (
          <GroupedRow key={item.id} last={i === rows.length - 1}>
            <OutcomeWord outcome={item.outcome} />
            <View style={styles.flex}>
              <Text style={styles.headline}>{item.title}</Text>
              <DataText numberOfLines={2}>{item.detail}</DataText>
              <DataText>
                {new Date(item.createdAt).toLocaleString()}
                {item.projectId ? ` · ${item.projectId}` : ''}
              </DataText>
            </View>
          </GroupedRow>
        ))}
      </GroupedList>
    </View>
  );
}

export function EnvDriftSection({ report }: { report: EnvDriftReport | null }) {
  return (
    <ContentCard>
      <SectionLabel>Env drift (names only)</SectionLabel>
      {report ? (
        <>
          <Text style={styles.body}>{report.summary}</Text>
          {report.findings.slice(0, 8).map((f) => (
            <DataText key={`${f.kind}-${f.key}`}>· {f.key}</DataText>
          ))}
        </>
      ) : (
        <Text style={styles.sub}>No env check yet.</Text>
      )}
    </ContentCard>
  );
}

export function DomainsSection({
  report,
}: {
  report: DomainDiagnosticsReport | null;
}) {
  return (
    <ContentCard>
      <SectionLabel>Domains</SectionLabel>
      {report ? (
        <>
          <Text style={styles.body}>{report.summary}</Text>
          {report.availability !== 'ok' ? (
            <Text style={styles.muted}>
              {availabilityLabel(report.availability)}
              {report.note ? ` — ${report.note}` : ''}
            </Text>
          ) : null}
          {report.domains.map((d) => (
            <View key={d.name} style={styles.block}>
              <View style={styles.row}>
                <Text style={styles.headline}>{d.name}</Text>
                <StateWord
                  label={d.severity.toUpperCase()}
                  tone={
                    d.severity === 'critical'
                      ? 'error'
                      : d.severity === 'warning'
                        ? 'building'
                        : 'ready'
                  }
                />
              </View>
              <DataText>
                verify={d.verification} · dns={d.dns} · ssl={d.ssl}
              </DataText>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.sub}>No domain check yet.</Text>
      )}
    </ContentCard>
  );
}

export function ObservabilitySection({
  snapshot,
}: {
  snapshot: ObservabilitySnapshot | null;
}) {
  return (
    <ContentCard>
      <SectionLabel>
        {snapshot
          ? `Observability (${snapshot.periodLabel})`
          : 'Observability'}
      </SectionLabel>
      {snapshot ? (
        <>
          <Text style={styles.body}>{snapshot.headline}</Text>
          <MetricLine label="Pageviews" slot={snapshot.pageviews} />
          <MetricLine label="Visitors" slot={snapshot.visitors} />
          <MetricLine label="Error rate" slot={snapshot.errorRate} />
        </>
      ) : (
        <Text style={styles.sub}>No observability snapshot yet.</Text>
      )}
    </ContentCard>
  );
}

export function FirewallSection({
  report,
}: {
  report: FirewallExplanation | null;
}) {
  return (
    <ContentCard>
      <SectionLabel>Firewall (read-only)</SectionLabel>
      {report ? (
        <>
          <Text style={styles.body}>{report.headline}</Text>
          {report.bullets.map((b) => (
            <Text key={b} style={styles.finding}>
              · {b}
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.sub}>No firewall explanation yet.</Text>
      )}
    </ContentCard>
  );
}

export function FeatureFlagsSection({
  report,
}: {
  report: FeatureFlagsReport | null;
}) {
  return (
    <ContentCard>
      <SectionLabel>Feature flags (metadata)</SectionLabel>
      <Text style={styles.body}>
        {report?.summary ?? 'No feature-flag metadata yet.'}
      </Text>
    </ContentCard>
  );
}

export function RuntimeLogsSection({
  report,
}: {
  report: RuntimeLogReport | null;
}) {
  return (
    <ContentCard>
      <SectionLabel>Runtime logs (validated filters)</SectionLabel>
      <Text style={styles.body}>
        {report?.summary ?? 'No runtime log query yet.'}
      </Text>
    </ContentCard>
  );
}

export function IncidentSection({
  incident,
}: {
  incident: IncidentSummary | null;
}) {
  return (
    <ContentCard>
      <SectionLabel>Local incident summary</SectionLabel>
      {incident == null ? (
        <Text style={styles.sub}>No incident summary yet.</Text>
      ) : incident.confidence === 'low' ? (
        <Text style={styles.body}>
          {incident.headline}. Not enough signal to diagnose.
        </Text>
      ) : (
        <>
          <Text style={styles.headline}>{incident.headline}</Text>
          {incident.likelyCause ? (
            <Text style={styles.body}>Cause: {incident.likelyCause}</Text>
          ) : null}
          {incident.commitSubject ? (
            <>
              <Text style={styles.caption}>Commit</Text>
              <DataText>{incident.commitSubject}</DataText>
              {incident.commitSha ? (
                <DataText>{incident.commitSha}</DataText>
              ) : null}
            </>
          ) : null}
          {incident.evidence.length > 0 ? (
            <>
              <Text style={styles.caption}>Evidence</Text>
              {incident.evidence.map((e) => (
                <Text key={e} style={styles.finding}>
                  · {e}
                </Text>
              ))}
            </>
          ) : null}
          <Text style={styles.next}>{incident.suggestedAction}</Text>
        </>
      )}
    </ContentCard>
  );
}

export function CompareSection({ diff }: { diff: DeploymentDiff | null }) {
  return (
    <ContentCard>
      <SectionLabel>What changed</SectionLabel>
      {diff == null ? (
        <Text style={styles.sub}>No compare yet.</Text>
      ) : diff.riskLevel === 'low' ? (
        <Text style={styles.body}>No significant change.</Text>
      ) : (
        <>
          <View style={styles.row}>
            <StateWord
              label={diff.riskLevel.toUpperCase()}
              tone={
                diff.riskLevel === 'high'
                  ? 'error'
                  : diff.riskLevel === 'medium'
                    ? 'building'
                    : 'ready'
              }
            />
            <DataText>
              score {diff.riskScore}/100 · similarity {diff.similarityScore}
            </DataText>
          </View>
          <Text style={styles.body}>{diff.summary}</Text>
          {diff.bullets.map((b) => (
            <Text key={b} style={styles.finding}>
              · {b}
            </Text>
          ))}
        </>
      )}
    </ContentCard>
  );
}

export function BuildLogsSection({
  lines,
  limit = 40,
}: {
  lines: { text: string; type?: string | null; created?: number | null }[];
  limit?: number;
}) {
  const tail = lines.slice(-limit);
  return (
    <ContentCard>
      <SectionLabel>Build log tail</SectionLabel>
      {tail.length > 0 ? (
        tail.map((line) => (
          <DataText
            key={`${line.created ?? 'log'}:${line.type ?? 'out'}:${line.text}`}
          >
            {line.text}
          </DataText>
        ))
      ) : (
        <Text style={styles.sub}>No build logs loaded.</Text>
      )}
    </ContentCard>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, marginTop: 4 },
  headline: { ...typography.headline, marginTop: 6 },
  sub: { ...typography.subhead, marginTop: 4 },
  caption: { ...typography.caption, marginTop: 4 },
  finding: { ...typography.footnote, marginTop: 4 },
  muted: { color: colors.textTertiary },
  next: { ...typography.footnote, marginTop: spacing.sm },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  block: { marginTop: spacing.md },
  flex: { flex: 1, minWidth: 0, gap: 2, paddingVertical: spacing.xs },
});
