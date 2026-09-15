import { DataText } from '../../design-system/ConsoleType';
import { useApp } from '../../shell/AppContext';
import type { DeploymentID, ProjectID } from '../../domain/models/ids';
import {
  AccountSection,
  ActivityListSection,
  BuildLogsSection,
  CompareSection,
  DeploymentListSection,
  DomainsSection,
  EnvDriftSection,
  FeatureFlagsSection,
  FirewallSection,
  IncidentSection,
  OpsBriefSection,
  ProjectListSection,
  RuntimeLogsSection,
  SearchSummarySection,
} from '../ops/OpsSections';
import type { SearchWidgetId } from './searchWidgets';

const SNIPPET = 8;

export function SearchResults({
  widgets,
  reason,
  answer,
  nextSteps,
  status,
  onProjectPicked,
  onDeploymentPicked,
  openDeployOnSelect = false,
}: {
  widgets: SearchWidgetId[];
  reason?: string | null;
  answer?: string | null;
  nextSteps?: string[];
  status?: string | null;
  onProjectPicked?: (id: ProjectID) => void;
  onDeploymentPicked?: (id: DeploymentID) => void;
  openDeployOnSelect?: boolean;
}) {
  const {
    connection,
    isRehydrating,
    setSettingsOpen,
    selectTeam,
    projects,
    selectProject,
    deployments,
    selectedDeployment,
    selectDeployment,
    recentActivity,
    opsNarrative,
    envDrift,
    domainReport,

    firewall,
    featureFlags,
    runtimeLogs,
    incident,
    deploymentDiff,
    buildLogs,
    isBusy,
  } = useApp();

  return (
    <>
      <SearchSummarySection
        reason={reason}
        answer={answer}
        nextSteps={nextSteps}
      />
      {status ? <DataText>{status}</DataText> : null}
      {isBusy && widgets.length > 0 ? (
        <DataText>Loading live signals…</DataText>
      ) : null}
      {widgets.map((id) => {
        switch (id) {
          case 'brief':
            return <OpsBriefSection key={id} narrative={opsNarrative} />;
          case 'account':
            return (
              <AccountSection
                key={id}
                connection={connection}
                isRehydrating={isRehydrating}
                onOpenSettings={() => setSettingsOpen(true)}
                onSelectTeam={(teamId) => void selectTeam(teamId)}
              />
            );
          case 'projects':
            return (
              <ProjectListSection
                key={id}
                projects={projects}
                limit={SNIPPET}
                onSelect={(projectId) => {
                  if (onProjectPicked) onProjectPicked(projectId);
                  else void selectProject(projectId);
                }}
                empty="No projects for this team."
              />
            );
          case 'deploys':
            return (
              <DeploymentListSection
                key={id}
                deployments={deployments}
                selectedId={selectedDeployment?.id}
                limit={SNIPPET}
                selectsOnly={!openDeployOnSelect}
                onSelect={(deployId) => {
                  if (onDeploymentPicked) onDeploymentPicked(deployId);
                  else void selectDeployment(deployId);
                }}
                empty="No deployments loaded for the selected project."
              />
            );
          case 'activity':
            return (
              <ActivityListSection
                key={id}
                items={recentActivity}
                limit={SNIPPET}
              />
            );
          case 'env':
            return <EnvDriftSection key={id} report={envDrift} />;
          case 'domain':
            return <DomainsSection key={id} report={domainReport} />;
          case 'firewall':
            return <FirewallSection key={id} report={firewall} />;
          case 'flags':
            return <FeatureFlagsSection key={id} report={featureFlags} />;
          case 'runtime':
            return <RuntimeLogsSection key={id} report={runtimeLogs} />;
          case 'incident':
            return <IncidentSection key={id} incident={incident} />;
          case 'compare':
            return <CompareSection key={id} diff={deploymentDiff} />;
          case 'logs':
            return (
              <BuildLogsSection key={id} lines={buildLogs} limit={24} />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
