import { useEffect, useMemo } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApp } from '../../shell/AppContext';
import {
  colors,
  layout,
  radii,
  spacing,
  typography,
} from '../../design-system/theme';
import { FilterChip } from '../../design-system/GlassChrome';
import {
  connectionIsConnected,
  type VercelConnection,
  type VercelProject,
} from '../../domain/models/vercelModels';
import { rankSites } from '../../domain/models/siteScope';
import type { OpsNarrative } from '../../domain/analysis/opsNarrative';
import { AccessibilityIDs } from '../../support/accessibilityIDs';
import { openSitePicker } from '../../shell/nav';
import { EmptySitePrompt } from '../sites/EmptySitePrompt';
import {
  AccountSection,
  OpsBriefSection,
  ProjectListSection,
} from '../ops/OpsSections';
import { SiteRack } from './SiteRack';

function HomeBanners({
  projectsFromCache,
  projectsCachedAt,
  pollingDeploymentId,
  lastError,
}: {
  projectsFromCache: boolean;
  projectsCachedAt: string | null;
  pollingDeploymentId: string | null;
  lastError: string | null;
}) {
  return (
    <>
      {projectsFromCache && projectsCachedAt ? (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheText}>
            Showing cached projects (as of{' '}
            {new Date(projectsCachedAt).toLocaleString()}). Pull refresh when
            connected for live data.
          </Text>
        </View>
      ) : null}
      {pollingDeploymentId ? (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheText}>
            Deploy poll active. READY only when Vercel confirms.
          </Text>
        </View>
      ) : null}
      {lastError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{lastError}</Text>
        </View>
      ) : null}
    </>
  );
}

function HomeBody({
  connected,
  connection,
  isRehydrating,
  selectedProject,
  otherAttention,
  onDeviceAvailable,
  opsNarrative,
  projects,
  isBusy,
  onOpenSettings,
  onDiagnose,
  onSelectProject,
}: {
  connected: boolean;
  connection: VercelConnection;
  isRehydrating: boolean;
  selectedProject: VercelProject | null;
  otherAttention: number;
  onDeviceAvailable: boolean;
  opsNarrative: OpsNarrative | null;
  projects: VercelProject[];
  isBusy: boolean;
  onOpenSettings: () => void;
  onDiagnose: () => void;
  onSelectProject: (id: VercelProject['id']) => void;
}) {
  if (!connected) {
    return (
      <View testID={AccessibilityIDs.connectButton}>
        <AccountSection
          connection={connection}
          isRehydrating={isRehydrating}
          onOpenSettings={onOpenSettings}
        />
      </View>
    );
  }
  if (selectedProject) {
    return (
      <>
        {otherAttention > 0 ? (
          <FilterChip
            label={`${otherAttention} other site${otherAttention === 1 ? '' : 's'}`}
            selected={false}
            onPress={openSitePicker}
          />
        ) : null}
        <SiteRack
          project={selectedProject}
          canDiagnose={onDeviceAvailable}
          onDiagnose={onDiagnose}
        />
        {opsNarrative ? <OpsBriefSection narrative={opsNarrative} /> : null}
      </>
    );
  }
  return (
    <>
      <EmptySitePrompt message="Pick a site to inspect health and deploys." />
      <View testID={AccessibilityIDs.projectList}>
        <ProjectListSection
          projects={rankSites(projects)}
          sectionLabel="Sites"
          onSelect={onSelectProject}
          empty={isBusy ? 'Loading sites…' : 'No sites found for this team.'}
        />
      </View>
    </>
  );
}

export function HomeScreen() {
  const {
    connection,
    projects,
    isBusy,
    isRehydrating,
    lastError,
    setSettingsOpen,
    selectProject,
    selectedProject,
    projectsFromCache,
    projectsCachedAt,
    runOpsBrief,
    opsNarrative,
    pollingDeploymentId,
    onDeviceAvailable,
  } = useApp();

  const connected = connectionIsConnected(connection);
  const otherAttention = useMemo(
    () =>
      projects.filter(
        (p) => p.needsAttention && p.id !== selectedProject?.id,
      ).length,
    [projects, selectedProject?.id],
  );

  useEffect(() => {
    if (lastError) AccessibilityInfo.announceForAccessibility(lastError);
  }, [lastError]);

  useEffect(() => {
    if (pollingDeploymentId) {
      AccessibilityInfo.announceForAccessibility(
        'Deployment polling started. Taktung will announce confirmed results in Activity.',
      );
    }
  }, [pollingDeploymentId]);

  return (
    <View style={styles.root} testID={AccessibilityIDs.tabHome}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HomeBanners
          projectsFromCache={projectsFromCache}
          projectsCachedAt={projectsCachedAt}
          pollingDeploymentId={pollingDeploymentId}
          lastError={lastError}
        />

        <HomeBody
          connected={connected}
          connection={connection}
          isRehydrating={isRehydrating}
          selectedProject={selectedProject}
          otherAttention={otherAttention}
          onDeviceAvailable={onDeviceAvailable}
          opsNarrative={opsNarrative}
          projects={projects}
          isBusy={isBusy}
          onOpenSettings={() => setSettingsOpen(true)}
          onDiagnose={() => void runOpsBrief()}
          onSelectProject={(id) => void selectProject(id)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    padding: spacing.md,
  },
  errorText: { ...typography.footnote, color: colors.danger },
  cacheBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    padding: spacing.md,
  },
  cacheText: { ...typography.footnote, color: colors.onAccentContainer },
});
