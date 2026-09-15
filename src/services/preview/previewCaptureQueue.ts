import { absoluteDeploymentUrl } from '../../domain/analysis/deploymentPreview';

export type PreviewCaptureJob = {
  url: string;
  resolve: (uri: string | null) => void;
  signal?: AbortSignal;
};

type Handler = (job: PreviewCaptureJob) => void;

let handler: Handler | null = null;
const pending: PreviewCaptureJob[] = [];

export function registerPreviewCaptureHandler(next: Handler | null): void {
  handler = next;
  if (!next) return;
  while (pending.length > 0) {
    next(pending.shift()!);
  }
}

export function enqueuePreviewCapture(
  pageUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const abs = absoluteDeploymentUrl(pageUrl);
  if (!abs) return Promise.resolve(null);
  return new Promise((resolve) => {
    const job: PreviewCaptureJob = { url: abs, resolve, signal };
    if (handler) handler(job);
    else pending.push(job);
  });
}
