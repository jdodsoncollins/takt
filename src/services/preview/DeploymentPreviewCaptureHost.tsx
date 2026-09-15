import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';
import { isUnusablePreviewLocation } from '../../domain/analysis/deploymentPreview';
import {
  registerPreviewCaptureHandler,
  type PreviewCaptureJob,
} from './previewCaptureQueue';
import { rememberPreviewCapture } from './deploymentPreviewClient';

export const PREVIEW_CAPTURE_WIDTH = 360;
export const PREVIEW_CAPTURE_MIN_HEIGHT = 640;
export const PREVIEW_CAPTURE_MAX_HEIGHT = 1600;
export const PREVIEW_CAPTURE_MS = 8_000;

const SIZE_SCRIPT = `
(function() {
  function report() {
    var h = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0,
      640
    );
    window.ReactNativeWebView.postMessage(JSON.stringify({
      t: 'ready',
      h: h,
      w: window.innerWidth || 360,
      title: document.title || '',
      href: String(location.href)
    }));
  }
  function start() {
    report();
    setTimeout(report, 450);
    setTimeout(report, 1400);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
  true;
})();
`;

/**
 * One off-screen WebView. Loads READY deployment URLs in series, sizes to the
 * document height (capped), and snapshots the painted page — not og:image.
 */
export function DeploymentPreviewCaptureHost() {
  const [job, setJob] = useState<PreviewCaptureJob | null>(null);
  const [height, setHeight] = useState(PREVIEW_CAPTURE_MIN_HEIGHT);
  const queue = useRef<PreviewCaptureJob[]>([]);
  const busy = useRef(false);
  const shotRef = useRef<View>(null);
  const jobRef = useRef<PreviewCaptureJob | null>(null);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (settle.current) clearTimeout(settle.current);
    if (loadFallback.current) clearTimeout(loadFallback.current);
    timer.current = null;
    settle.current = null;
    loadFallback.current = null;
  }, []);

  const finish = useCallback(
    (uri: string | null, opts?: { cache?: boolean }) => {
      if (finished.current) return;
      finished.current = true;
      clearTimers();
      const current = jobRef.current;
      jobRef.current = null;
      setJob(null);
      setHeight(PREVIEW_CAPTURE_MIN_HEIGHT);
      if (current) {
        if (opts?.cache !== false) rememberPreviewCapture(current.url, uri);
        current.resolve(uri);
      }
      busy.current = false;
      const next = queue.current.shift();
      if (next) {
        busy.current = true;
        finished.current = false;
        jobRef.current = next;
        setJob(next);
      }
    },
    [clearTimers],
  );

  const kick = useCallback((incoming?: PreviewCaptureJob) => {
    if (incoming) queue.current.push(incoming);
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    finished.current = false;
    jobRef.current = next;
    setHeight(PREVIEW_CAPTURE_MIN_HEIGHT);
    setJob(next);
  }, []);

  useEffect(() => {
    registerPreviewCaptureHandler(kick);
    return () => registerPreviewCaptureHandler(null);
  }, [kick]);

  useEffect(() => {
    if (!job) return;
    if (job.signal?.aborted) {
      finish(null, { cache: false });
      return;
    }
    const onAbort = () => finish(null, { cache: false });
    job.signal?.addEventListener('abort', onAbort);
    timer.current = setTimeout(() => finish(null), PREVIEW_CAPTURE_MS);
    return () => {
      job.signal?.removeEventListener('abort', onAbort);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [finish, job]);

  const capture = useCallback(async () => {
    if (finished.current) return;
    if (!shotRef.current) {
      finish(null);
      return;
    }
    try {
      const uri = await captureRef(shotRef, {
        format: 'jpg',
        quality: 0.55,
        width: PREVIEW_CAPTURE_WIDTH,
        result: 'tmpfile',
      });
      finish(typeof uri === 'string' ? uri : null);
    } catch {
      finish(null);
    }
  }, [finish]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let payload: {
        t?: string;
        h?: number;
        w?: number;
        title?: string;
        href?: string;
      };
      try {
        payload = JSON.parse(event.nativeEvent.data) as typeof payload;
      } catch {
        return;
      }
      if (payload.t !== 'ready' || finished.current) return;
      const href = payload.href ?? jobRef.current?.url ?? '';
      const title = payload.title ?? '';
      if (isUnusablePreviewLocation(href, title)) {
        finish(null);
        return;
      }
      const pageW =
        payload.w && payload.w > 0 ? payload.w : PREVIEW_CAPTURE_WIDTH;
      const rawH = payload.h ?? PREVIEW_CAPTURE_MIN_HEIGHT;
      const scaled = Math.round(rawH * (PREVIEW_CAPTURE_WIDTH / pageW));
      const nextH = Math.min(
        PREVIEW_CAPTURE_MAX_HEIGHT,
        Math.max(PREVIEW_CAPTURE_MIN_HEIGHT, scaled),
      );
      setHeight(nextH);
      if (loadFallback.current) {
        clearTimeout(loadFallback.current);
        loadFallback.current = null;
      }
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        void capture();
      }, 420);
    },
    [capture, finish],
  );

  if (Platform.OS === 'web') return null;

  return (
    <View
      pointerEvents="none"
      style={styles.host}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {job ? (
        <View
          ref={shotRef}
          collapsable={false}
          style={{
            width: PREVIEW_CAPTURE_WIDTH,
            height,
            backgroundColor: '#ffffff',
          }}
        >
          <WebView
            key={job.url}
            source={{ uri: job.url }}
            style={{ width: PREVIEW_CAPTURE_WIDTH, height }}
            originWhitelist={['*']}
            javaScriptEnabled
            incognito
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            automaticallyAdjustContentInsets={false}
            mediaPlaybackRequiresUserAction
            setSupportMultipleWindows={false}
            androidLayerType="hardware"
            injectedJavaScript={SIZE_SCRIPT}
            onMessage={onMessage}
            onHttpError={() => finish(null)}
            onError={() => finish(null)}
            onNavigationStateChange={(nav) => {
              if (isUnusablePreviewLocation(nav.url, nav.title ?? '')) {
                finish(null);
              }
            }}
            onLoadEnd={() => {
              if (finished.current || loadFallback.current) return;
              loadFallback.current = setTimeout(() => {
                void capture();
              }, 2_400);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: PREVIEW_CAPTURE_WIDTH,
    height: PREVIEW_CAPTURE_MAX_HEIGHT,
    left: 0,
    top: 0,
    zIndex: -1,
    overflow: 'hidden',
  },
});
