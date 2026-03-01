import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppServices } from './app/AppServicesContext'
import { Toolbar } from './components/Toolbar'
import { MarkdownEditorPane, type MarkdownEditorComponent } from './components/MarkdownEditorPane'
import { PreviewPane } from './components/PreviewPane'
import { DropZone } from './components/DropZone'
import { ErrorBanner } from './components/ErrorBanner'
import { LanguagePicker } from './components/LanguagePicker'
import type { ExportFormat, RenderResult } from './domain/types'
import { buildStandaloneHtml } from './infrastructure/export/buildStandaloneHtml'
import { asDiagnosticsMessage, createDiagnosticsChannelId } from './infrastructure/export/diagnostics'
import { useI18n } from './i18n/I18nContext'

const EMPTY_RENDER_RESULT: RenderResult = {
  html: '',
  css: '',
  slideCount: 0
}

export const RENDER_DEBOUNCE_MS = 150

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

interface AppProps {
  editorComponent?: MarkdownEditorComponent
  renderDebounceMs?: number
}

export default function App({ editorComponent, renderDebounceMs = RENDER_DEBOUNCE_MS }: AppProps) {
  const services = useAppServices()
  const { messages } = useI18n()
  const [markdown, setMarkdown] = useState('')
  const [busyAction, setBusyAction] = useState<ExportFormat | 'open' | null>(null)
  const [renderResult, setRenderResult] = useState<RenderResult>(EMPTY_RENDER_RESULT)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [previewDiagnosticErrors, setPreviewDiagnosticErrors] = useState<string[]>([])
  const [previewDiagnosticsChannelId, setPreviewDiagnosticsChannelId] = useState(() =>
    createDiagnosticsChannelId('preview')
  )

  const markdownRef = useRef(markdown)

  useEffect(() => {
    markdownRef.current = markdown
  }, [markdown])

  useEffect(() => {
    return services.beforeUnload.attach(() => markdownRef.current.trim().length > 0)
  }, [services.beforeUnload])

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const diagnosticsMessage = asDiagnosticsMessage(event.data)

      if (!diagnosticsMessage) {
        return
      }

      if (diagnosticsMessage.channelId !== previewDiagnosticsChannelId) {
        return
      }

      setPreviewDiagnosticErrors((currentErrors) => {
        if (currentErrors.includes(diagnosticsMessage.message)) {
          return currentErrors
        }

        return [...currentErrors, diagnosticsMessage.message]
      })
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [previewDiagnosticsChannelId])

  const resetPreviewDiagnostics = useCallback(() => {
    setPreviewDiagnosticErrors([])
    setPreviewDiagnosticsChannelId(createDiagnosticsChannelId('preview'))
  }, [])

  useEffect(() => {
    if (markdown.trim().length === 0) {
      setRenderResult(EMPTY_RENDER_RESULT)
      setRenderError(null)
      resetPreviewDiagnostics()
      return
    }

    const runRender = () => {
      try {
        const result = services.renderer.render(markdown)
        setRenderResult(result)
        setRenderError(null)
        resetPreviewDiagnostics()
      } catch (error) {
        setRenderResult(EMPTY_RENDER_RESULT)
        setRenderError(toErrorMessage(error, messages.unknownError))
        resetPreviewDiagnostics()
      }
    }

    if (renderDebounceMs <= 0) {
      runRender()
      return
    }

    const timer = window.setTimeout(runRender, renderDebounceMs)

    return () => {
      window.clearTimeout(timer)
    }
  }, [markdown, messages.unknownError, renderDebounceMs, resetPreviewDiagnostics, services.renderer])

  const hasMarkdown = markdown.trim().length > 0
  const canExportHtml = hasMarkdown
  const canExportPdf = hasMarkdown && previewDiagnosticErrors.length === 0

  const pdfDisabledReason = !hasMarkdown
    ? messages.addMarkdownToEnablePdfExport
    : previewDiagnosticErrors.length > 0
      ? messages.resolvePreviewLoadingErrorsToExportPdf
      : undefined

  const replaceMarkdownWithConfirmation = useCallback(
    (nextMarkdown: string): boolean => {
      if (markdown.trim().length > 0) {
        const confirmed = services.confirm.confirm(messages.replaceMarkdownConfirm)

        if (!confirmed) {
          return false
        }
      }

      setMarkdown(nextMarkdown)
      return true
    },
    [markdown, messages.replaceMarkdownConfirm, services.confirm]
  )

  const handleOpenMarkdown = useCallback(async () => {
    setActionError(null)
    setBusyAction('open')

    try {
      const nextMarkdown = await services.importer.pickAndRead()

      if (nextMarkdown === null) {
        return
      }

      replaceMarkdownWithConfirmation(nextMarkdown)
    } catch (error) {
      setActionError(messages.failedToOpenMarkdownFile(toErrorMessage(error, messages.unknownError)))
    } finally {
      setBusyAction(null)
    }
  }, [messages, replaceMarkdownWithConfirmation, services.importer])

  const runExport = useCallback(
    async (format: ExportFormat, action: () => Promise<void> | void) => {
      setActionError(null)
      setBusyAction(format)

      try {
        await action()
      } catch (error) {
        const errorMessage = toErrorMessage(error, messages.unknownError)
        const nextActionError =
          format === 'html' ? messages.failedToExportHtml(errorMessage) : messages.failedToExportPdf(errorMessage)
        setActionError(nextActionError)
      } finally {
        setBusyAction(null)
      }
    },
    [messages]
  )

  const handleDropMarkdownFile = useCallback(
    async (file: File) => {
      setActionError(null)

      try {
        const nextMarkdown = await services.importer.readDropped(file)
        replaceMarkdownWithConfirmation(nextMarkdown)
      } catch (error) {
        setActionError(messages.failedToReadDroppedFile(toErrorMessage(error, messages.unknownError)))
      }
    },
    [messages, replaceMarkdownWithConfirmation, services.importer]
  )

  const previewDocumentHtml = useMemo(
    () =>
      buildStandaloneHtml(renderResult, messages.previewDocumentTitle, {
        diagnosticsChannelId: previewDiagnosticsChannelId
      }),
    [messages.previewDocumentTitle, previewDiagnosticsChannelId, renderResult]
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-4 p-4 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{messages.appTitle}</h1>
            <p className="mt-1 text-sm text-slate-600">{messages.appSubtitle}</p>
          </div>
          <LanguagePicker />
        </div>

        <Toolbar
          canExportHtml={canExportHtml}
          canExportPdf={canExportPdf}
          busyAction={busyAction}
          pdfDisabledReason={pdfDisabledReason}
          onOpenMarkdown={() => {
            void handleOpenMarkdown()
          }}
          onExportHtml={() => {
            void runExport('html', () => services.htmlExporter.export(markdown))
          }}
          onExportPdf={() => {
            void runExport('pdf', () => services.pdfExporter.export(markdown))
          }}
        />

        {actionError && <ErrorBanner message={actionError} />}

        <div className="grid flex-1 gap-4 lg:grid-cols-2">
          <DropZone onMarkdownFileDrop={handleDropMarkdownFile}>
            <MarkdownEditorPane value={markdown} onChange={setMarkdown} EditorComponent={editorComponent} />
          </DropZone>

          <PreviewPane
            documentHtml={previewDocumentHtml}
            slideCount={renderResult.slideCount}
            diagnosticErrors={previewDiagnosticErrors}
            errorMessage={renderError}
          />
        </div>
      </main>
    </div>
  )
}
