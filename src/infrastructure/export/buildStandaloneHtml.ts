import type { RenderResult } from '../../domain/types'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './diagnostics'
import { PRESENTATION_MESSAGE_SOURCE } from '../presentation/messages'

export interface StandaloneHtmlOptions {
  diagnosticsChannelId?: string
  scriptNonce?: string
}

export interface PresentationSlideHtmlOptions {
  channelId: string
  scriptNonce?: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function generateScriptNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const nonceBytes = new Uint8Array(16)
    crypto.getRandomValues(nonceBytes)
    return Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
}

function normalizeScriptNonce(nonce: string): string {
  const normalizedNonce = nonce.trim()

  if (normalizedNonce.length === 0) {
    return generateScriptNonce()
  }

  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(normalizedNonce)) {
    return normalizedNonce
  }

  return generateScriptNonce()
}

function buildContentSecurityPolicy(scriptNonce: string): string {
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "script-src 'nonce-" + scriptNonce + "'",
    "style-src 'unsafe-inline' https: http:",
    'img-src data: blob: https: http:',
    'font-src data: https: http:',
    'media-src data: blob: https: http:',
    'frame-src https: http:',
    'connect-src https: http:'
  ].join('; ')
}

function buildDiagnosticsScript(diagnosticsChannelId: string, scriptNonce: string): string {
  const channelLiteral = JSON.stringify(diagnosticsChannelId)
  const sourceLiteral = JSON.stringify(DIAGNOSTICS_MESSAGE_SOURCE)

  return `<script nonce="${escapeHtml(scriptNonce)}">(() => {
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

function buildPresentationBridgeScript(channelId: string, scriptNonce: string): string {
  const channelLiteral = JSON.stringify(channelId)
  const sourceLiteral = JSON.stringify(PRESENTATION_MESSAGE_SOURCE)

  return `<script nonce="${escapeHtml(scriptNonce)}">(() => {
    const PRESENTATION_CHANNEL_ID = ${channelLiteral};
    const PRESENTATION_SOURCE = ${sourceLiteral};
    const nextKeys = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']);
    const previousKeys = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);

    const emitNavigate = (action) => {
      window.parent.postMessage({
        source: PRESENTATION_SOURCE,
        channelId: PRESENTATION_CHANNEL_ID,
        type: 'navigate',
        action
      }, '*');
    };

    const emitExit = () => {
      window.parent.postMessage({
        source: PRESENTATION_SOURCE,
        channelId: PRESENTATION_CHANNEL_ID,
        type: 'exit'
      }, '*');
    };

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        emitExit();
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        emitNavigate('first');
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        emitNavigate('last');
        return;
      }

      if (nextKeys.has(event.key)) {
        event.preventDefault();
        emitNavigate('next');
        return;
      }

      if (previousKeys.has(event.key)) {
        event.preventDefault();
        emitNavigate('previous');
      }
    };

    const handleClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      const target = event.target;

      if (target && typeof target.closest === 'function' && target.closest('a, button, input, textarea, select, summary, label')) {
        return;
      }

      const width = window.innerWidth;

      if (width <= 0) {
        return;
      }

      const leftBoundary = width / 3;
      const rightBoundary = (width / 3) * 2;

      if (event.clientX < leftBoundary) {
        emitNavigate('previous');
        return;
      }

      if (event.clientX > rightBoundary) {
        emitNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);

    if (document.body && typeof document.body.focus === 'function') {
      document.body.tabIndex = -1;
      document.body.focus();
    }
  })();</script>`
}

function buildDeckMarkup(renderResult: RenderResult): string {
  return `<div class="marpit">${renderResult.html.join('')}</div>`
}

export function buildStandaloneHtml(
  renderResult: RenderResult,
  title = 'MD Slides',
  options: StandaloneHtmlOptions = {}
): string {
  const scriptNonce = normalizeScriptNonce(options.scriptNonce ?? generateScriptNonce())
  const diagnosticsScript = options.diagnosticsChannelId
    ? buildDiagnosticsScript(options.diagnosticsChannelId, scriptNonce)
    : ''
  const contentSecurityPolicy = buildContentSecurityPolicy(scriptNonce)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${escapeHtml(contentSecurityPolicy)}" />
    <title>${escapeHtml(title)}</title>
    <style>${renderResult.css}</style>
  </head>
  <body>
    ${buildDeckMarkup(renderResult)}
    ${diagnosticsScript}
  </body>
</html>`
}

export function buildPresentationSlideHtml(
  slideHtml: string,
  css: string,
  title = 'MD Slides',
  options: PresentationSlideHtmlOptions
): string {
  const scriptNonce = normalizeScriptNonce(options.scriptNonce ?? generateScriptNonce())
  const presentationBridgeScript = buildPresentationBridgeScript(options.channelId, scriptNonce)
  const contentSecurityPolicy = buildContentSecurityPolicy(scriptNonce)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${escapeHtml(contentSecurityPolicy)}" />
    <title>${escapeHtml(title)}</title>
    <style>${css}</style>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #000;
      }

      body {
        display: flex;
        align-items: stretch;
        justify-content: stretch;
      }

      .marpit {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .marpit > svg[data-marpit-svg] {
        width: 100vw;
        height: 100vh;
        max-width: 100vw;
        max-height: 100vh;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="marpit">${slideHtml}</div>
    ${presentationBridgeScript}
  </body>
</html>`
}
