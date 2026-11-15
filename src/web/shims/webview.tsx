/**
 * Web replacement for `react-native-webview`, covering what the map view
 * needs: inline HTML, `onMessage`, and `injectJavaScript`. Rendered as an
 * iframe with a small postMessage bridge.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';

export interface WebViewMessageEvent {
  nativeEvent: { data: string };
}

interface WebViewProps {
  source?: { html?: string; uri?: string };
  onMessage?: (event: WebViewMessageEvent) => void;
  style?: any;
  [key: string]: any;
}

const BRIDGE_SCRIPT = `<script>
(function () {
  window.ReactNativeWebView = {
    postMessage: function (data) {
      window.parent.postMessage({ __rnWebView: true, data: String(data) }, '*');
    }
  };
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || !event.data || typeof event.data.__rnInject !== 'string') {
      return;
    }
    try { (0, eval)(event.data.__rnInject); } catch (error) { console.warn('injectJavaScript failed', error); }
  });
})();
</script>`;

function withBridge(html: string): string {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${BRIDGE_SCRIPT}`);
  }
  return `${BRIDGE_SCRIPT}${html}`;
}

export const WebView = forwardRef<any, WebViewProps>(function WebView(
  { source, onMessage, style },
  ref
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useImperativeHandle(ref, () => ({
    injectJavaScript: (script: string) => {
      iframeRef.current?.contentWindow?.postMessage({ __rnInject: script }, '*');
    },
    reload: () => {
      const iframe = iframeRef.current;
      if (iframe) {
        // eslint-disable-next-line no-self-assign
        iframe.srcdoc = iframe.srcdoc;
      }
    },
  }), []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.source !== iframeRef.current?.contentWindow
        || !event.data
        || event.data.__rnWebView !== true
      ) {
        return;
      }
      onMessageRef.current?.({ nativeEvent: { data: event.data.data } });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const srcDoc = useMemo(
    () => (source?.html ? withBridge(source.html) : undefined),
    [source?.html]
  );
  const flatStyle = StyleSheet.flatten(style) ?? {};

  return React.createElement('iframe', {
    ref: iframeRef,
    srcDoc,
    src: srcDoc ? undefined : source?.uri,
    title: 'Embedded content',
    allow: 'geolocation',
    style: {
      border: 'none',
      width: '100%',
      height: '100%',
      display: 'block',
      ...(flatStyle as object),
    },
  });
});

export default WebView;
