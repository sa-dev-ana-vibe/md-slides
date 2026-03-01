import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppServices } from './app/AppServicesContext'
import type { ExportFormat, RenderResult } from './domain/types'
import { buildStandaloneHtml } from './infrastructure/export/buildStandaloneHtml'
import { Toolbar } from './components/Toolbar'
import { MarkdownEditorPane, type MarkdownEditorComponent } from './components/MarkdownEditorPane'
import { PreviewPane } from './components/PreviewPane'
import { DropZone } from './components/DropZone'
import { ErrorBanner } from './components/ErrorBanner'

const EMPTY_RENDER_RESULT: RenderResult = {
  html: '',
  css: '',
  slideCount: 0
}

export const RENDER_DEBOUNCE_MS = 150

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

interface AppProps {
  editorComponent?: MarkdownEditorComponent
  renderDebounceMs?: number
}

export default function App({ editorComponent, renderDebounceMs = RENDER_DEBOUNCE_MS }: AppProps) {
  const services = useAppServices()
  const [markdown, setMarkdown] = useState('')
  const [busyAction, setBusyAction] = useState<ExportFormat | 'open' | null>(null)
  const [renderResult, setRenderResult] = useState<RenderResult>(EMPTY_RENDER_RESULT)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const markdownRef = useRef(markdown)

  useEffect(() => {
    markdownRef.current = markdown
  }, [markdown])

  useEffect(() => {
    return services.beforeUnload.attach(() => markdownRef.current.trim().length > 0)
  }, [services.beforeUnload])

  useEffect(() => {
    if (markdown.trim().length === 0) {
      setRenderResult(EMPTY_RENDER_RESULT)
      setRenderError(null)
      return
    }

    const runRender = () => {
      try {
        const result = services.renderer.render(markdown)
        setRenderResult(result)
        setRenderError(null)
      } catch (error) {
        setRenderResult(EMPTY_RENDER_RESULT)
        setRenderError(toErrorMessage(error))
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
  }, [markdown, renderDebounceMs, services.renderer])

  const canExport = markdown.trim().length > 0

  const replaceMarkdownWithConfirmation = useCallback(
    (nextMarkdown: string): boolean => {
      if (markdown.trim().length > 0) {
        const confirmed = services.confirm.confirm('Current markdown will be replaced. Continue?')

        if (!confirmed) {
          return false
        }
      }

      setMarkdown(nextMarkdown)
      return true
    },
    [markdown, services.confirm]
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
      setActionError(`Failed to open Markdown file: ${toErrorMessage(error)}`)
    } finally {
      setBusyAction(null)
    }
  }, [replaceMarkdownWithConfirmation, services.importer])

  const runExport = useCallback(
    async (format: ExportFormat, action: () => Promise<void> | void) => {
      setActionError(null)
      setBusyAction(format)

      try {
        await action()
      } catch (error) {
        setActionError(`Failed to export ${format.toUpperCase()}: ${toErrorMessage(error)}`)
      } finally {
        setBusyAction(null)
      }
    },
    []
  )

  const handleDropMarkdownFile = useCallback(
    async (file: File) => {
      setActionError(null)

      try {
        const nextMarkdown = await services.importer.readDropped(file)
        replaceMarkdownWithConfirmation(nextMarkdown)
      } catch (error) {
        setActionError(`Failed to read dropped file: ${toErrorMessage(error)}`)
      }
    },
    [replaceMarkdownWithConfirmation, services.importer]
  )

  const previewDocumentHtml = useMemo(() => buildStandaloneHtml(renderResult, 'MD Slides Preview'), [renderResult])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-4 p-4 lg:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MD Slides</h1>
          <p className="mt-1 text-sm text-slate-600">Create Marp slides from markdown, fully in the browser.</p>
        </div>

        <Toolbar
          canExport={canExport}
          busyAction={busyAction}
          onOpenMarkdown={() => {
            void handleOpenMarkdown()
          }}
          onExportHtml={() => {
            void runExport('html', () => services.htmlExporter.export(markdown))
          }}
          onExportPdf={() => {
            void runExport('pdf', () => services.pdfExporter.export(markdown))
          }}
          onExportPptx={() => {
            void runExport('pptx', () => services.pptxExporter.export(markdown))
          }}
        />

        {actionError && <ErrorBanner message={actionError} />}

        <div className="grid flex-1 gap-4 lg:grid-cols-2">
          <DropZone onMarkdownFileDrop={handleDropMarkdownFile}>
            <MarkdownEditorPane value={markdown} onChange={setMarkdown} EditorComponent={editorComponent} />
          </DropZone>

          <PreviewPane documentHtml={previewDocumentHtml} slideCount={renderResult.slideCount} errorMessage={renderError} />
        </div>
      </main>
    </div>
  )
}
