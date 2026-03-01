import type { PdfExporter, SlidesDiagnosticsInspector, SlidesRenderer } from '../../domain/services'
import { asDiagnosticsMessage, createDiagnosticsChannelId } from './diagnostics'
import { buildStandaloneHtml } from './buildStandaloneHtml'

type PrintLifecycleEvent = 'beforeprint' | 'afterprint'

interface PrintLifecycleTarget {
  addEventListener: (event: PrintLifecycleEvent, listener: () => void) => void
  removeEventListener: (event: PrintLifecycleEvent, listener: () => void) => void
}

interface MessageEventTarget {
  addEventListener: (event: 'message', listener: (event: { data: unknown }) => void) => void
  removeEventListener: (event: 'message', listener: (event: { data: unknown }) => void) => void
}

interface PrintableFrameWindow extends PrintLifecycleTarget {
  focus?: () => void
  print: () => void
}

interface PrintableIframe {
  style: Partial<CSSStyleDeclaration>
  srcdoc: string
  contentWindow: PrintableFrameWindow | null
  onload: (() => void) | null
  onerror: (() => void) | null
  remove: () => void
}

interface PrintHostDocument {
  body: {
    appendChild: (node: PrintableIframe) => void
  } | null
}

interface BrowserPdfExporterDeps {
  renderer: SlidesRenderer
  diagnosticsInspector?: SlidesDiagnosticsInspector
  createIframe?: () => PrintableIframe
  hostDocument?: PrintHostDocument
  hostWindow?: PrintLifecycleTarget
  hostMessageTarget?: MessageEventTarget
  setTimeoutFn?: (callback: () => void, delayMs: number) => number
  clearTimeoutFn?: (timeoutId: number) => void
  frameLoadTimeoutMs?: number
  printStartTimeoutMs?: number
  printCloseTimeoutMs?: number
}

export class BrowserPdfExporter implements PdfExporter {
  static readonly DEFAULT_FRAME_LOAD_TIMEOUT_MS = 5_000
  static readonly DEFAULT_PRINT_START_TIMEOUT_MS = 2_000
  static readonly DEFAULT_PRINT_CLOSE_TIMEOUT_MS = 300_000

  private readonly renderer: SlidesRenderer
  private readonly diagnosticsInspector: SlidesDiagnosticsInspector
  private readonly createIframe: () => PrintableIframe
  private readonly hostDocument: PrintHostDocument
  private readonly hostWindow: PrintLifecycleTarget
  private readonly hostMessageTarget: MessageEventTarget
  private readonly setTimeoutFn: (callback: () => void, delayMs: number) => number
  private readonly clearTimeoutFn: (timeoutId: number) => void
  private readonly frameLoadTimeoutMs: number
  private readonly printStartTimeoutMs: number
  private readonly printCloseTimeoutMs: number

  constructor({
    renderer,
    diagnosticsInspector = { inspect: async () => [] },
    createIframe = () => document.createElement('iframe') as unknown as PrintableIframe,
    hostDocument = document as unknown as PrintHostDocument,
    hostWindow = window as unknown as PrintLifecycleTarget,
    hostMessageTarget = window as unknown as MessageEventTarget,
    setTimeoutFn = window.setTimeout.bind(window),
    clearTimeoutFn = window.clearTimeout.bind(window),
    frameLoadTimeoutMs = BrowserPdfExporter.DEFAULT_FRAME_LOAD_TIMEOUT_MS,
    printStartTimeoutMs = BrowserPdfExporter.DEFAULT_PRINT_START_TIMEOUT_MS,
    printCloseTimeoutMs = BrowserPdfExporter.DEFAULT_PRINT_CLOSE_TIMEOUT_MS
  }: BrowserPdfExporterDeps) {
    this.renderer = renderer
    this.diagnosticsInspector = diagnosticsInspector
    this.createIframe = createIframe
    this.hostDocument = hostDocument
    this.hostWindow = hostWindow
    this.hostMessageTarget = hostMessageTarget
    this.setTimeoutFn = setTimeoutFn
    this.clearTimeoutFn = clearTimeoutFn
    this.frameLoadTimeoutMs = frameLoadTimeoutMs
    this.printStartTimeoutMs = printStartTimeoutMs
    this.printCloseTimeoutMs = printCloseTimeoutMs
  }

  private waitForIframeLoad(iframe: PrintableIframe): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = this.setTimeoutFn(() => {
        iframe.onload = null
        iframe.onerror = null
        reject(new Error('Timed out waiting for print frame to load.'))
      }, this.frameLoadTimeoutMs)

      iframe.onload = () => {
        this.clearTimeoutFn(timeoutId)
        iframe.onload = null
        iframe.onerror = null
        resolve()
      }

      iframe.onerror = () => {
        this.clearTimeoutFn(timeoutId)
        iframe.onload = null
        iframe.onerror = null
        reject(new Error('Unable to load print frame.'))
      }
    })
  }

  private createDiagnosticsErrorPromise(diagnosticsChannelId: string): {
    errorPromise: Promise<never>
    cleanup: () => void
  } {
    let listener: (event: { data: unknown }) => void = () => undefined

    const errorPromise = new Promise<never>((_, reject) => {
      listener = (event) => {
        const diagnosticsMessage = asDiagnosticsMessage(event.data)

        if (!diagnosticsMessage) {
          return
        }

        if (diagnosticsMessage.channelId !== diagnosticsChannelId) {
          return
        }

        reject(new Error(diagnosticsMessage.message))
      }

      this.hostMessageTarget.addEventListener('message', listener)
    })

    const cleanup = () => {
      this.hostMessageTarget.removeEventListener('message', listener)
      listener = () => undefined
    }

    return { errorPromise, cleanup }
  }

  private waitForPrintLifecycle(frameWindow: PrintableFrameWindow): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const eventTargets: PrintLifecycleTarget[] = Array.from(new Set([frameWindow, this.hostWindow]))
      let settled = false
      let printStarted = false
      let closeTimeoutId: number | null = null

      const removeListeners = () => {
        for (const target of eventTargets) {
          target.removeEventListener('beforeprint', onBeforePrint)
          target.removeEventListener('afterprint', onAfterPrint)
        }
      }

      const clearCloseTimeout = () => {
        if (closeTimeoutId !== null) {
          this.clearTimeoutFn(closeTimeoutId)
          closeTimeoutId = null
        }
      }

      const finalizeResolve = () => {
        settled = true
        this.clearTimeoutFn(startTimeoutId)
        clearCloseTimeout()
        removeListeners()
        resolve()
      }

      const finalizeReject = (error: unknown) => {
        settled = true
        this.clearTimeoutFn(startTimeoutId)
        clearCloseTimeout()
        removeListeners()
        reject(error instanceof Error ? error : new Error(String(error)))
      }

      const onBeforePrint = () => {
        if (settled || printStarted) {
          return
        }

        printStarted = true
        this.clearTimeoutFn(startTimeoutId)
        closeTimeoutId = this.setTimeoutFn(() => {
          finalizeReject(new Error('Timed out waiting for print dialog to close.'))
        }, this.printCloseTimeoutMs)
      }

      const onAfterPrint = () => {
        if (!printStarted) {
          printStarted = true
        }

        finalizeResolve()
      }

      const startTimeoutId = this.setTimeoutFn(() => {
        finalizeReject(new Error('Print dialog did not start.'))
      }, this.printStartTimeoutMs)

      for (const target of eventTargets) {
        target.addEventListener('beforeprint', onBeforePrint)
        target.addEventListener('afterprint', onAfterPrint)
      }

      try {
        frameWindow.focus?.()
        frameWindow.print()
      } catch (error) {
        finalizeReject(error)
      }
    })
  }

  private async printInIframe(standaloneHtml: string, diagnosticsChannelId: string): Promise<void> {
    const body = this.hostDocument.body

    if (!body) {
      throw new Error('Unable to render print frame in this document.')
    }

    const iframe = this.createIframe()
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.right = '0'
    iframe.style.bottom = '0'

    const diagnostics = this.createDiagnosticsErrorPromise(diagnosticsChannelId)

    try {
      const loadPromise = this.waitForIframeLoad(iframe)
      iframe.srcdoc = standaloneHtml
      body.appendChild(iframe)

      await Promise.race([loadPromise, diagnostics.errorPromise])

      const frameWindow = iframe.contentWindow

      if (!frameWindow) {
        throw new Error('Unable to access print frame window.')
      }

      await Promise.race([this.waitForPrintLifecycle(frameWindow), diagnostics.errorPromise])
    } finally {
      diagnostics.cleanup()
      iframe.onload = null
      iframe.onerror = null
      iframe.remove()
    }
  }

  async export(markdown: string): Promise<void> {
    const rendered = this.renderer.render(markdown)
    const diagnosticsIssues = await this.diagnosticsInspector.inspect(rendered)

    if (diagnosticsIssues.length > 0) {
      throw new Error(diagnosticsIssues[0])
    }

    const diagnosticsChannelId = createDiagnosticsChannelId('pdf-export')
    const standaloneHtml = buildStandaloneHtml(rendered, 'MD Slides PDF Export', {
      diagnosticsChannelId
    })

    await this.printInIframe(standaloneHtml, diagnosticsChannelId)
  }
}
