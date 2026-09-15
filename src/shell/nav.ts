import type { AppTab } from './AppContext';

type RouterLike = {
  navigate: (href: string) => void;
  push: (href: string) => void;
  back: () => void;
  canGoBack: () => boolean;
};

function getRouter(): RouterLike | null {
  try {
    return require('expo-router').router as RouterLike;
  } catch {
    return null;
  }
}

/** Product navigation lives in `app/` (Expo Router). Domain code stays in `src/shell`. */
export function navigateTab(tab: AppTab): void {
  const router = getRouter();
  if (!router) return;
  if (tab === 'home') router.navigate('/home');
  else if (tab === 'deployments') router.navigate('/deployments');
  else router.navigate('/activity');
}

export function openSettings(): void {
  getRouter()?.push('/settings');
}

export function openSitePicker(): void {
  getRouter()?.push('/sites');
}

export function openAssistant(): void {
  getRouter()?.navigate('/search');
}

export function openDeployment(id: string): void {
  getRouter()?.push(`/deployment/${id}`);
}

export function openDeploymentHosts(id: string): void {
  getRouter()?.push(`/hosts/${id}`);
}

export function openDeploymentFunctions(id: string): void {
  getRouter()?.push(`/functions/${id}`);
}

export function closeModal(): void {
  const router = getRouter();
  if (router?.canGoBack()) router.back();
}