import type { RenderResult } from '../../domain/types'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './diagnostics'
import { PRESENTATION_MESSAGE_SOURCE } from '../presentation/messages'

export interface StandaloneHtmlOptions {
  diagnosticsChannelId?: string
  presentation?: {
    channelId: string
  }
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

function buildPresentationStyle(): string {
  return `<style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #000;
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    div.marpit {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }

    div.marpit > svg[data-marpit-svg] {
      width: 100vw;
      height: 100vh;
      max-width: 100vw;
      max-height: 100vh;
      display: none;
    }

    div.marpit > svg[data-marpit-svg][data-presentation-visible="true"] {
      display: block;
    }
  </style>`
}

function buildPresentationScript(channelId: string): string {
  const channelLiteral = JSON.stringify(channelId)
  const sourceLiteral = JSON.stringify(PRESENTATION_MESSAGE_SOURCE)

  return `<script>(() => {
    const PRESENTATION_CHANNEL_ID = ${channelLiteral};
    const PRESENTATION_SOURCE = ${sourceLiteral};
    const slides = Array.from(document.querySelectorAll('svg[data-marpit-svg]'));
    const nextKeys = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']);
    const previousKeys = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);
    const maxIndex = Math.max(slides.length - 1, 0);
    let currentIndex = 0;

    const clamp = (index) => Math.min(Math.max(index, 0), maxIndex);

    const render = () => {
      slides.forEach((slide, index) => {
        slide.setAttribute('data-presentation-visible', index === currentIndex ? 'true' : 'false');
      });
    };

    const navigateTo = (index) => {
      const nextIndex = clamp(index);

      if (nextIndex === currentIndex) {
        return;
      }

      currentIndex = nextIndex;
      render();
    };

    const navigatePrevious = () => {
      navigateTo(currentIndex - 1);
    };

    const navigateNext = () => {
      navigateTo(currentIndex + 1);
    };

    const emitExit = () => {
      window.parent.postMessage({
        source: PRESENTATION_SOURCE,
        type: 'exit',
        channelId: PRESENTATION_CHANNEL_ID
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
        navigateTo(0);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        navigateTo(maxIndex);
        return;
      }

      if (nextKeys.has(event.key)) {
        event.preventDefault();
        navigateNext();
        return;
      }

      if (previousKeys.has(event.key)) {
        event.preventDefault();
        navigatePrevious();
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
        navigatePrevious();
        return;
      }

      if (event.clientX > rightBoundary) {
        navigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);

    if (slides.length > 0) {
      render();
    }

    if (document.body && typeof document.body.focus === 'function') {
      document.body.tabIndex = -1;
      document.body.focus();
    }
  })();</script>`
}

export function buildStandaloneHtml(
  renderResult: RenderResult,
  title = 'MD Slides',
  options: StandaloneHtmlOptions = {}
): string {
  const diagnosticsScript = options.diagnosticsChannelId ? buildDiagnosticsScript(options.diagnosticsChannelId) : ''
  const presentationStyle = options.presentation ? buildPresentationStyle() : ''
  const presentationScript = options.presentation ? buildPresentationScript(options.presentation.channelId) : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>${renderResult.css}</style>
    ${presentationStyle}
  </head>
  <body>
    ${renderResult.html}
    ${diagnosticsScript}
    ${presentationScript}
  </body>
</html>`
}
