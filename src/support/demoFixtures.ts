import {
  deploymentID,
  projectID,
  teamID,
  type DeploymentID,
  type ProjectID,
} from '../domain/models/ids';
import type {
  ActivityItem,
  VercelConnection,
  VercelDeploymentSummary,
  VercelProject,
  VercelTeam,
  VercelUser,
} from '../domain/models/vercelModels';

export const DEMO_TEAM_ID = teamID('team_demo');

export const DEMO_PROJECT_ID = {
  portfolio: projectID('prj_demo_portfolio'),
  store: projectID('prj_demo_store'),
  docs: projectID('prj_demo_docs'),
  blog: projectID('prj_demo_blog'),
} as const;

export const DEMO_USER: VercelUser = {
  id: 'uid_demo',
  name: 'Example',
  username: 'example',
  email: null,
};

export const DEMO_TEAM: VercelTeam = {
  id: DEMO_TEAM_ID,
  name: 'Example team',
  slug: 'example-team',
};

type SiteSpec = {
  id: ProjectID;
  name: string;
  domain: string;
  repo: string;
  framework: string;
  commit: string;
  sha: string;
};

const SITES: SiteSpec[] = [
  {
    id: DEMO_PROJECT_ID.portfolio,
    name: 'example-portfolio',
    domain: 'example-portfolio.app',
    repo: 'portfolio',
    framework: 'nextjs',
    commit: 'Update landing page layout',
    sha: '7f3a21c9e0ab4d1',
  },
  {
    id: DEMO_PROJECT_ID.store,
    name: 'example-store',
    domain: 'example-store.app',
    repo: 'store',
    framework: 'nextjs',
    commit: 'Fix checkout button spacing',
    sha: 'b4c91e20aa17d8f',
  },
  {
    id: DEMO_PROJECT_ID.docs,
    name: 'example-docs',
    domain: 'example-docs.app',
    repo: 'docs',
    framework: 'nextjs',
    commit: 'Update getting started guide',
    sha: 'c8d02f41bb90e3a',
  },
  {
    id: DEMO_PROJECT_ID.blog,
    name: 'example-blog',
    domain: 'example-blog.app',
    repo: 'blog',
    framework: 'nextjs',
    commit: 'Add post about launch week',
    sha: 'd1e38a56cc04b72',
  },
];

const PORTFOLIO_COMMITS: { message: string; sha: string; minutesAgo: number }[] =
  [
    { message: 'Update landing page layout', sha: '7f3a21c9e0ab4d1', minutesAgo: 12 },
    { message: 'Tighten mobile hero spacing', sha: 'aecd30ab19c4e02', minutesAgo: 17 },
    { message: 'Fix production image cache', sha: '0b4ed78c2aa91f3', minutesAgo: 31 },
    { message: 'Refresh project README', sha: 'cff17d71e8b03a4', minutesAgo: 38 },
    { message: 'Improve navigation labels', sha: 'db3060d44c1e5b6', minutesAgo: 62 },
    { message: 'Align section headings', sha: '18f3391aa07c8d2', minutesAgo: 68 },
    { message: 'Restore production redirect', sha: 'ad584e3221b9f70', minutesAgo: 75 },
    { message: 'Reduce unused CSS', sha: '2960bda88e4c1a3', minutesAgo: 130 },
    { message: 'Fix footer link order', sha: 'a085fa011d7e9c4', minutesAgo: 185 },
    { message: 'Add missing alt text', sha: '95cc1bc77a2d8e1', minutesAgo: 190 },
    { message: 'Ship dark-mode tokens', sha: '044666f5b3c0a29', minutesAgo: 310 },
    { message: 'Polish contact form', sha: '1f970133e6d4b80', minutesAgo: 430 },
    { message: 'Bump dependencies', sha: '0459e571aa8c2f6', minutesAgo: 540 },
    { message: 'Adjust card shadows', sha: '5571c7e90bb3d14', minutesAgo: 660 },
    { message: 'Clean up unused routes', sha: 'd032d73cc91e5a8', minutesAgo: 720 },
    { message: 'Refresh Open Graph images', sha: 'b20c45811f7a6d0', minutesAgo: 740 },
  ];

const PREVIEW_FAILURES: { message: string; sha: string; minutesAgo: number }[] =
  [
    { message: 'Fix preview build cache', sha: '1cff9c4aa02e7b1', minutesAgo: 545 },
    { message: 'Retry broken preview compile', sha: '88a1b2c3d4e5f60', minutesAgo: 800 },
    { message: 'Restore missing preview env keys', sha: 'f1e2d3c4b5a6978', minutesAgo: 900 },
  ];

function deploy(input: {
  id: string;
  name: string;
  state: VercelDeploymentSummary['state'];
  target: VercelDeploymentSummary['target'];
  createdAt: number;
  message: string;
  sha: string;
  ref?: string;
}): VercelDeploymentSummary {
  return {
    id: deploymentID(input.id),
    url: null,
    name: input.name,
    state: input.state,
    target: input.target,
    createdAt: input.createdAt,
    readyAt: input.state === 'READY' ? input.createdAt + 32_000 : null,
    buildingAt: input.createdAt - 12_000,
    source: 'git',
    creatorUsername: 'example',
    isRollbackCandidate: input.state === 'READY' && input.target === 'production',
    region: 'iad1',
    meta: {
      githubCommitRef: input.ref ?? 'main',
      githubCommitSha: input.sha,
      githubCommitMessage: input.message,
      githubCommitAuthorLogin: 'example',
      githubCommitAuthorName: null,
    },
    inspectorUrl: null,
  };
}

export function buildDemoConnection(): VercelConnection {
  return {
    status: 'connected',
    user: DEMO_USER,
    teams: [DEMO_TEAM],
    selectedTeamId: DEMO_TEAM_ID,
    errorMessage: null,
  };
}

export function buildDemoDeployments(
  projectId: ProjectID,
  now = Date.now(),
): VercelDeploymentSummary[] {
  const site = SITES.find((s) => s.id === projectId);
  if (!site) return [];
  if (projectId !== DEMO_PROJECT_ID.portfolio) {
    return [
      deploy({
        id: `dpl_demo_${site.repo}_prod`,
        name: site.name,
        state: 'READY',
        target: 'production',
        createdAt: now - 36 * 60_000,
        message: site.commit,
        sha: site.sha,
      }),
    ];
  }
  const ready = PORTFOLIO_COMMITS.map((row, i) =>
    deploy({
      id: `dpl_demo_portfolio_${i}`,
      name: site.name,
      state: 'READY',
      target: 'production',
      createdAt: now - row.minutesAgo * 60_000,
      message: row.message,
      sha: row.sha,
    }),
  );
  const failed = PREVIEW_FAILURES.map((row, i) =>
    deploy({
      id: `dpl_demo_portfolio_fail_${i}`,
      name: site.name,
      state: 'ERROR',
      target: 'preview',
      createdAt: now - row.minutesAgo * 60_000,
      message: row.message,
      sha: row.sha,
      ref: 'preview',
    }),
  );
  return [...ready, ...failed].sort((a, b) => b.createdAt - a.createdAt);
}

export function buildDemoProjects(now = Date.now()): VercelProject[] {
  return SITES.map((site) => {
    const deploys = buildDemoDeployments(site.id, now);
    const production =
      deploys.find((d) => d.target === 'production' && d.state === 'READY') ??
      null;
    return {
      id: site.id,
      name: site.name,
      framework: site.framework,
      nodeVersion: '22.x',
      primaryDomain: site.domain,
      productionDeployment: production,
      latestDeployment: deploys[0] ?? production,
      lastSuccessfulDeployment: production,
      latestFailedDeployment: null,
      needsAttention: false,
      attentionReason: 'none' as const,
      teamId: DEMO_TEAM_ID,
      link: { type: 'github', org: 'example', repo: site.repo },
    };
  });
}

export function findDemoDeployment(
  id: DeploymentID,
  now = Date.now(),
): VercelDeploymentSummary | null {
  for (const site of SITES) {
    const match = buildDemoDeployments(site.id, now).find((d) => d.id === id);
    if (match) return match;
  }
  return null;
}

export function buildDemoActivity(now = Date.now()): ActivityItem[] {
  const iso = (minutesAgo: number) =>
    new Date(now - minutesAgo * 60_000).toISOString();
  return [
    {
      id: 'act_demo_loaded',
      kind: 'refresh_projects',
      title: 'Loaded projects',
      detail: '4 project(s) (list without N+1 deploy fan-out)',
      outcome: 'success',
      createdAt: iso(2),
    },
    {
      id: 'act_demo_connect',
      kind: 'connect',
      title: 'Connected to Vercel',
      detail: 'Restored personal access token session',
      outcome: 'success',
      createdAt: iso(2),
    },
    {
      id: 'act_demo_deploys',
      kind: 'load_deployments',
      title: 'Loaded deployments',
      detail: '19 deployment(s)',
      outcome: 'success',
      createdAt: iso(3),
    },
    {
      id: 'act_demo_refresh',
      kind: 'refresh_projects',
      title: 'refresh projects',
      detail: 'refresh_projects:success',
      outcome: 'success',
      createdAt: iso(8),
    },
    {
      id: 'act_demo_connect_earlier',
      kind: 'connect',
      title: 'connect',
      detail: 'connect:success',
      outcome: 'success',
      createdAt: iso(8),
    },
  ];
}

export function demoHasIdentifyingCopy(text: string): boolean {
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) && !/@example\./i.test(text);
}
