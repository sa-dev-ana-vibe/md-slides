import type { RenderResult } from '../../domain/types'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './diagnostics'

export interface StandaloneHtmlOptions {
  diagnosticsChannelId?: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildDiagnosticsScript(diagnosticsChannelId: string): string {
  const channelLiteral = JSON.stringify(diagnosticsChannelId)
  const sourceLiteral = JSON.stringify(DIAGNOSTICS_MESSAGE_SOURCE)

  return `<script>(() => {
    const DIAGNOSTICS_CHANNEL_ID = ${channelLiteral};
    const DIAGNOSTICS_SOURCE = ${sourceLiteral};
    const seenErrors = new Set();

    const stringifyReason = (value) => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object' && typeof value.message === 'string') return value.message;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const emit = (rawMessage) => {
      const message = String(rawMessage ?? '').trim();

      if (!message || seenErrors.has(message)) {
        return;
      }

      seenErrors.add(message);
      window.parent.postMessage({
        source: DIAGNOSTICS_SOURCE,
        channelId: DIAGNOSTICS_CHANNEL_ID,
        type: 'error',
        message
      }, '*');
    };

    window.addEventListener('error', (event) => {
      const target = event.target;

      if (target && target !== window) {
        const resourceUrl =
          target.currentSrc ||
          target.src ||
          target.href ||
          (typeof target.getAttribute === 'function' ? target.getAttribute('src') || target.getAttribute('href') : '') ||
          '';

        const tagName = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : 'RESOURCE';
        const eventMessage = typeof event.message === 'string' && event.message.trim().length > 0 ? event.message : '';

        emit(eventMessage || ('Failed to load ' + tagName + (resourceUrl ? ': ' + resourceUrl : '')));
        return;
      }

      const runtimeMessage =
        typeof event.message === 'string' && event.message.trim().length > 0
          ? event.message
          : event.error && typeof event.error.message === 'string' && event.error.message.trim().length > 0
            ? event.error.message
            : 'Unknown runtime error';

      const location =
        typeof event.filename === 'string' && event.filename.length > 0
          ? ' (' +
            event.filename +
            (typeof event.lineno === 'number' ? ':' + event.lineno : '') +
            (typeof event.colno === 'number' ? ':' + event.colno : '') +
            ')'
          : '';

      emit(runtimeMessage + location);
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
      const reason = stringifyReason(event.reason);
      emit(reason || 'Unhandled promise rejection');
    });
  })();</script>`
}

export function buildStandaloneHtml(
  renderResult: RenderResult,
  title = 'MD Slides',
  options: StandaloneHtmlOptions = {}
): string {
  const diagnosticsScript = options.diagnosticsChannelId ? buildDiagnosticsScript(options.diagnosticsChannelId) : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>${renderResult.css}</style>
  </head>
  <body>
    ${renderResult.html}
    ${diagnosticsScript}
  </body>
</html>`
}
