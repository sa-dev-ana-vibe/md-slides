import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppServices } from './app/AppServicesContext'
import { AskAiModal } from './components/AskAiModal'
import { Toolbar } from './components/Toolbar'
import { MarkdownEditorPane, type MarkdownEditorComponent } from './components/MarkdownEditorPane'
import { PreviewPane } from './components/PreviewPane'
import { DropZone } from './components/DropZone'
import { ErrorBanner } from './components/ErrorBanner'
import { LanguagePicker } from './components/LanguagePicker'
import { PresentationOverlay } from './components/PresentationOverlay'
import type { ExportFormat, RenderResult } from './domain/types'
import { buildStandaloneHtml } from './infrastructure/export/buildStandaloneHtml'
import { buildHtmlExportFileName } from './infrastructure/export/buildHtmlExportFileName'
import { asDiagnosticsMessage, createDiagnosticsChannelId } from './infrastructure/export/diagnostics'
import { getBuiltInThemeNames, mergeThemeNames } from './infrastructure/marp/themeNames'
import { applyFrontMatterOverrides, extractFrontMatterDeckSettings } from './infrastructure/marp/frontMatterSettings'
import {
  buildAskAiFullPrompt,
  buildChatGptPromptUrl,
  type SizePreset,
  type TargetSlideVibe
} from './infrastructure/prompt/buildAskAiPrompt'
import { createPresentationChannelId } from './infrastructure/presentation/messages'
import { useI18n } from './i18n/I18nContext'

const EMPTY_RENDER_RESULT: RenderResult = {
  html: [],
  css: ''
}

interface PreviewDiagnosticsState {
  markdownSnapshot: string | null
  pending: boolean
  errors: string[]
}

const EMPTY_PREVIEW_DIAGNOSTICS_STATE: PreviewDiagnosticsState = {
  markdownSnapshot: null,
  pending: false,
  errors: []
}

export const RENDER_DEBOUNCE_MS = 150
export const CHAT_GPT_PROMPT_BASE_URL = 'https://chatgpt.com/?prompt='

interface ClipboardWriter {
  writeText(text: string): Promise<void>
}

type OpenExternalUrl = (url: string) => Window | null

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  return fallback
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function normalizeDiagnosticsIssues(issues: readonly string[]): string[] {
  return Array.from(new Set(issues.map((issue) => issue.trim()).filter((issue) => issue.length > 0)))
}

function appendUniqueDiagnosticIssue(currentIssues: string[], nextIssue: string): string[] {
  const normalizedIssue = nextIssue.trim()

  if (normalizedIssue.length === 0 || currentIssues.includes(normalizedIssue)) {
    return currentIssues
  }

  return [...currentIssues, normalizedIssue]
}

function toKnownSizePreset(sizePreset: string | undefined): SizePreset {
  if (sizePreset === '16:9' || sizePreset === '4:3') {
    return sizePreset
  }

  return ''
}

function writeTextToClipboard(text: string): Promise<void> {
  const clipboard = (navigator as unknown as { clipboard?: Clipboard }).clipboard

  if (!clipboard) {
    throw new Error('Clipboard API unavailable.')
  }

  return clipboard.writeText(text)
}

const DEFAULT_CLIPBOARD_WRITER: ClipboardWriter = {
  writeText: writeTextToClipboard
}

const DEFAULT_OPEN_EXTERNAL_URL: OpenExternalUrl = (url) => window.open(url, '_blank', 'noopener,noreferrer')

interface AppProps {
  editorComponent?: MarkdownEditorComponent
  renderDebounceMs?: number
  getBuiltInThemeNamesFn?: () => readonly string[]
  customThemeNames?: readonly string[]
  clipboardWriter?: ClipboardWriter
  openExternalUrl?: OpenExternalUrl
  chatGptBaseUrl?: string
}

export default function App({
  editorComponent,
  renderDebounceMs = RENDER_DEBOUNCE_MS,
  getBuiltInThemeNamesFn = getBuiltInThemeNames,
  customThemeNames = [],
  clipboardWriter = DEFAULT_CLIPBOARD_WRITER,
  openExternalUrl = DEFAULT_OPEN_EXTERNAL_URL,
  chatGptBaseUrl = CHAT_GPT_PROMPT_BASE_URL
}: AppProps) {
  const services = useAppServices()
  const { messages } = useI18n()
  const [markdown, setMarkdown] = useState('')
  const [busyAction, setBusyAction] = useState<ExportFormat | 'open' | null>(null)
  const [sourceFileName, setSourceFileName] = useState<string | null>(null)
  const [isAskAiOpen, setIsAskAiOpen] = useState(false)
  const [askAiBrief, setAskAiBrief] = useState('')
  const [askAiThemeName, setAskAiThemeName] = useState('default')
  const [askAiTargetSlideCount, setAskAiTargetSlideCount] = useState<TargetSlideVibe>('medium')
  const [askAiSizePreset, setAskAiSizePreset] = useState<SizePreset>('')
  const [previewThemeOverride, setPreviewThemeOverride] = useState<string | null>(null)
  const [previewSizeOverride, setPreviewSizeOverride] = useState<SizePreset | null>(null)
  const [renderResult, setRenderResult] = useState<RenderResult>(EMPTY_RENDER_RESULT)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [previewDiagnostics, setPreviewDiagnostics] = useState<PreviewDiagnosticsState>(EMPTY_PREVIEW_DIAGNOSTICS_STATE)
  const [previewDiagnosticsChannelId, setPreviewDiagnosticsChannelId] = useState(() =>
    createDiagnosticsChannelId('preview')
  )
  const [isPresentationOpen, setIsPresentationOpen] = useState(false)
  const [presentationChannelId, setPresentationChannelId] = useState(() =>
    createPresentationChannelId('presentation')
  )

  const markdownRef = useRef(markdown)
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null)
  const previewDiagnosticsChannelIdRef = useRef(previewDiagnosticsChannelId)
  const previewDiagnosticsAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    markdownRef.current = markdown
  }, [markdown])

  useEffect(() => {
    return services.beforeUnload.attach(() => markdownRef.current.trim().length > 0)
  }, [services.beforeUnload])

  useEffect(() => {
    previewDiagnosticsChannelIdRef.current = previewDiagnosticsChannelId
  }, [previewDiagnosticsChannelId])

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const previewFrameWindow = previewFrameRef.current?.contentWindow

      if (!previewFrameWindow || event.source !== previewFrameWindow) {
        return
      }

      const diagnosticsMessage = asDiagnosticsMessage(event.data)

      if (!diagnosticsMessage) {
        return
      }

      if (diagnosticsMessage.channelId !== previewDiagnosticsChannelIdRef.current) {
        return
      }

      setPreviewDiagnostics((currentDiagnostics) => {
        const nextErrors = appendUniqueDiagnosticIssue(currentDiagnostics.errors, diagnosticsMessage.message)

        if (nextErrors === currentDiagnostics.errors) {
          return currentDiagnostics
        }

        return {
          ...currentDiagnostics,
          errors: nextErrors
        }
      })
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  const abortPreviewDiagnostics = useCallback(() => {
    previewDiagnosticsAbortControllerRef.current?.abort()
    previewDiagnosticsAbortControllerRef.current = null
  }, [])

  const rotatePreviewDiagnosticsChannel = useCallback((): string => {
    const nextChannelId = createDiagnosticsChannelId('preview')
    previewDiagnosticsChannelIdRef.current = nextChannelId
    setPreviewDiagnosticsChannelId(nextChannelId)
    return nextChannelId
  }, [])

  const clearPreviewDiagnostics = useCallback(() => {
    abortPreviewDiagnostics()
    rotatePreviewDiagnosticsChannel()
    setPreviewDiagnostics(EMPTY_PREVIEW_DIAGNOSTICS_STATE)
  }, [abortPreviewDiagnostics, rotatePreviewDiagnosticsChannel])

  const startPreviewDiagnostics = useCallback(
    (nextRenderResult: RenderResult, markdownSnapshot: string) => {
      const diagnosticsChannelId = rotatePreviewDiagnosticsChannel()
      abortPreviewDiagnostics()
      const abortController = new AbortController()
      previewDiagnosticsAbortControllerRef.current = abortController

      setPreviewDiagnostics({
        markdownSnapshot,
        pending: true,
        errors: []
      })

      void services.diagnosticsInspector
        .inspect(nextRenderResult, { signal: abortController.signal })
        .then((issues) => {
          if (previewDiagnosticsChannelIdRef.current !== diagnosticsChannelId) {
            return
          }

          const normalizedIssues = normalizeDiagnosticsIssues(issues)
          setPreviewDiagnostics((currentDiagnostics) => {
            if (currentDiagnostics.markdownSnapshot !== markdownSnapshot) {
              return currentDiagnostics
            }

            return {
              markdownSnapshot,
              pending: false,
              errors: normalizeDiagnosticsIssues([...currentDiagnostics.errors, ...normalizedIssues])
            }
          })
        })
        .catch((error) => {
          if (previewDiagnosticsChannelIdRef.current !== diagnosticsChannelId) {
            return
          }

          if (abortController.signal.aborted || isAbortError(error)) {
            return
          }

          setPreviewDiagnostics((currentDiagnostics) => {
            if (currentDiagnostics.markdownSnapshot !== markdownSnapshot) {
              return currentDiagnostics
            }

            return {
              markdownSnapshot,
              pending: false,
              errors: appendUniqueDiagnosticIssue(currentDiagnostics.errors, toErrorMessage(error, messages.unknownError))
            }
          })
        })
        .finally(() => {
          if (previewDiagnosticsAbortControllerRef.current === abortController) {
            previewDiagnosticsAbortControllerRef.current = null
          }
        })
    },
    [abortPreviewDiagnostics, messages.unknownError, rotatePreviewDiagnosticsChannel, services.diagnosticsInspector]
  )

  useEffect(() => {
    return () => {
      abortPreviewDiagnostics()
    }
  }, [abortPreviewDiagnostics])

  const deckFrontMatterSettings = useMemo(() => extractFrontMatterDeckSettings(markdown), [markdown])
  const effectiveMarkdown = useMemo(
    () =>
      applyFrontMatterOverrides(markdown, {
        themeName: previewThemeOverride ?? undefined,
        sizePreset: previewSizeOverride ?? undefined
      }),
    [markdown, previewSizeOverride, previewThemeOverride]
  )

  useEffect(() => {
    if (markdown.trim().length === 0) {
      return
    }

    abortPreviewDiagnostics()
    setPreviewDiagnostics({
      markdownSnapshot: null,
      pending: true,
      errors: []
    })
  }, [abortPreviewDiagnostics, effectiveMarkdown, markdown])

  useEffect(() => {
    if (markdown.trim().length === 0) {
      setRenderResult(EMPTY_RENDER_RESULT)
      setRenderError(null)
      clearPreviewDiagnostics()
      return
    }

    const runRender = () => {
      try {
        const result = services.renderer.render(effectiveMarkdown)
        setRenderResult(result)
        setRenderError(null)
        startPreviewDiagnostics(result, effectiveMarkdown)
      } catch (error) {
        setRenderResult(EMPTY_RENDER_RESULT)
        setRenderError(toErrorMessage(error, messages.unknownError))
        clearPreviewDiagnostics()
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
  }, [
    clearPreviewDiagnostics,
    effectiveMarkdown,
    markdown,
    messages.unknownError,
    renderDebounceMs,
    services.renderer,
    startPreviewDiagnostics
  ])

  const availableThemeNames = useMemo(
    () => mergeThemeNames(getBuiltInThemeNamesFn(), customThemeNames),
    [customThemeNames, getBuiltInThemeNamesFn]
  )
  const defaultAskAiThemeName = useMemo(
    () => availableThemeNames.find((themeName) => themeName.toLowerCase() === 'default') ?? availableThemeNames[0],
    [availableThemeNames]
  )
  const inferredPreviewThemeName = useMemo(() => {
    const frontMatterThemeName = deckFrontMatterSettings.themeName

    if (frontMatterThemeName && availableThemeNames.includes(frontMatterThemeName)) {
      return frontMatterThemeName
    }

    return defaultAskAiThemeName
  }, [availableThemeNames, deckFrontMatterSettings.themeName, defaultAskAiThemeName])
  const inferredPreviewSizePreset = useMemo(
    () => toKnownSizePreset(deckFrontMatterSettings.sizePreset),
    [deckFrontMatterSettings.sizePreset]
  )
  const previewThemeName = previewThemeOverride ?? inferredPreviewThemeName
  const previewSizePreset = previewSizeOverride ?? inferredPreviewSizePreset

  const slideCount = renderResult.html.length
  const hasMarkdown = markdown.trim().length > 0
  const previewDiagnosticErrors = previewDiagnostics.errors
  const previewDiagnosticsPending = previewDiagnostics.pending
  const isPreviewDiagnosticsFresh =
    !previewDiagnostics.pending && previewDiagnostics.markdownSnapshot === effectiveMarkdown
  const canExportHtml = hasMarkdown
  const canExportPdf =
    hasMarkdown && renderError === null && isPreviewDiagnosticsFresh && previewDiagnosticErrors.length === 0
  const canPresent = renderError === null && slideCount > 0

  const pdfDisabledReason = !hasMarkdown
    ? messages.addMarkdownToEnablePdfExport
    : previewDiagnosticsPending
      ? messages.checkingPreviewResourcesToEnablePdfExport
    : previewDiagnosticErrors.length > 0
      ? messages.resolvePreviewLoadingErrorsToExportPdf
      : undefined

  const replaceMarkdownWithConfirmation = useCallback(
    (nextMarkdown: string, nextSourceFileName: string | null): boolean => {
      if (markdownRef.current.trim().length > 0) {
        const confirmed = services.confirm.confirm(messages.replaceMarkdownConfirm)

        if (!confirmed) {
          return false
        }
      }

      setMarkdown(nextMarkdown)
      setSourceFileName(nextMarkdown.trim().length > 0 ? nextSourceFileName : null)
      return true
    },
    [messages.replaceMarkdownConfirm, services.confirm]
  )

  const handleMarkdownChange = useCallback((nextMarkdown: string) => {
    setMarkdown(nextMarkdown)

    if (nextMarkdown.trim().length === 0) {
      setSourceFileName(null)
    }
  }, [])

  const handleOpenMarkdown = useCallback(async () => {
    setActionError(null)
    setBusyAction('open')

    try {
      const importedFile = await services.importer.pickAndRead()

      if (importedFile === null) {
        return
      }

      replaceMarkdownWithConfirmation(importedFile.markdown, importedFile.fileName)
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
        replaceMarkdownWithConfirmation(nextMarkdown, file.name)
      } catch (error) {
        setActionError(messages.failedToReadDroppedFile(toErrorMessage(error, messages.unknownError)))
      }
    },
    [messages, replaceMarkdownWithConfirmation, services.importer]
  )

  const handleEnterPresentation = useCallback(() => {
    if (!canPresent) {
      return
    }

    setPresentationChannelId(createPresentationChannelId('presentation'))
    setIsPresentationOpen(true)
  }, [canPresent])

  const handleExitPresentation = useCallback(() => {
    setIsPresentationOpen(false)
  }, [])

  const handlePreviewThemeNameChange = useCallback(
    (nextThemeName: string) => {
      setPreviewThemeOverride(nextThemeName === inferredPreviewThemeName ? null : nextThemeName)
    },
    [inferredPreviewThemeName]
  )

  const handlePreviewSizePresetChange = useCallback(
    (nextSizePreset: SizePreset) => {
      setPreviewSizeOverride(nextSizePreset === inferredPreviewSizePreset ? null : nextSizePreset)
    },
    [inferredPreviewSizePreset]
  )

  const handleOpenAskAi = useCallback(() => {
    setActionError(null)
    setAskAiBrief('')
    setAskAiThemeName(previewThemeName)
    setAskAiTargetSlideCount('medium')
    setAskAiSizePreset(previewSizePreset)
    setIsAskAiOpen(true)
  }, [previewSizePreset, previewThemeName])

  const handleCloseAskAi = useCallback(() => {
    setIsAskAiOpen(false)
  }, [])

  const createAskAiPrompt = useCallback(
    () =>
      buildAskAiFullPrompt(
        {
          themeName: askAiThemeName,
          targetSlideCount: askAiTargetSlideCount,
          sizePreset: askAiSizePreset
        },
        askAiBrief
      ),
    [askAiBrief, askAiSizePreset, askAiTargetSlideCount, askAiThemeName]
  )

  const handleCopyAskAiPrompt = useCallback(async () => {
    setActionError(null)

    try {
      await clipboardWriter.writeText(createAskAiPrompt())
    } catch (error) {
      setActionError(messages.failedToCopyAskAiPrompt(toErrorMessage(error, messages.askAiClipboardUnavailable)))
    }
  }, [clipboardWriter, createAskAiPrompt, messages])

  const handleOpenChatGpt = useCallback(() => {
    setActionError(null)

    try {
      const url = buildChatGptPromptUrl(chatGptBaseUrl, createAskAiPrompt())
      const openedWindow = openExternalUrl(url)

      if (openedWindow === null) {
        throw new Error(messages.askAiPopupBlocked)
      }
    } catch (error) {
      setActionError(messages.failedToOpenChatGpt(toErrorMessage(error, messages.askAiPopupBlocked)))
    }
  }, [chatGptBaseUrl, createAskAiPrompt, messages, openExternalUrl])

  useEffect(() => {
    if (!isPresentationOpen) {
      return
    }

    if (!canPresent) {
      setIsPresentationOpen(false)
    }
  }, [canPresent, isPresentationOpen])

  useEffect(() => {
    if (availableThemeNames.some((themeName) => themeName === askAiThemeName)) {
      return
    }

    setAskAiThemeName(defaultAskAiThemeName)
  }, [askAiThemeName, availableThemeNames, defaultAskAiThemeName])

  useEffect(() => {
    if (previewThemeOverride === null) {
      return
    }

    if (availableThemeNames.some((themeName) => themeName === previewThemeOverride)) {
      return
    }

    setPreviewThemeOverride(defaultAskAiThemeName)
  }, [availableThemeNames, defaultAskAiThemeName, previewThemeOverride])

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
          canPresent={canPresent}
          busyAction={busyAction}
          pdfDisabledReason={pdfDisabledReason}
          onOpenAskAi={handleOpenAskAi}
          onOpenMarkdown={() => {
            void handleOpenMarkdown()
          }}
          onEnterPresentation={handleEnterPresentation}
          onExportHtml={() => {
            const fileName = buildHtmlExportFileName({ markdown, sourceFileName })
            void runExport('html', () => services.htmlExporter.export(effectiveMarkdown, fileName))
          }}
          onExportPdf={() => {
            void runExport('pdf', () => services.pdfExporter.export(effectiveMarkdown))
          }}
        />

        {actionError && <ErrorBanner message={actionError} />}

        <div className="grid flex-1 gap-4 lg:grid-cols-2">
          <DropZone onMarkdownFileDrop={handleDropMarkdownFile}>
            <MarkdownEditorPane value={markdown} onChange={handleMarkdownChange} EditorComponent={editorComponent} />
          </DropZone>

          <PreviewPane
            documentHtml={previewDocumentHtml}
            slideCount={slideCount}
            themeNames={availableThemeNames}
            themeName={previewThemeName}
            sizePreset={previewSizePreset}
            diagnosticErrors={previewDiagnosticErrors}
            diagnosticsPending={previewDiagnosticsPending}
            onThemeNameChange={handlePreviewThemeNameChange}
            onSizePresetChange={handlePreviewSizePresetChange}
            errorMessage={renderError}
            iframeRef={previewFrameRef}
          />
        </div>
      </main>

      {isPresentationOpen && (
        <PresentationOverlay
          slidesHtml={renderResult.html}
          css={renderResult.css}
          channelId={presentationChannelId}
          onExit={handleExitPresentation}
        />
      )}

      {isAskAiOpen && (
        <AskAiModal
          themeNames={availableThemeNames}
          userBrief={askAiBrief}
          themeName={askAiThemeName}
          targetSlideCount={askAiTargetSlideCount}
          sizePreset={askAiSizePreset}
          onUserBriefChange={setAskAiBrief}
          onThemeNameChange={setAskAiThemeName}
          onTargetSlideCountChange={setAskAiTargetSlideCount}
          onSizePresetChange={setAskAiSizePreset}
          onClose={handleCloseAskAi}
          onCopyPrompt={() => {
            void handleCopyAskAiPrompt()
          }}
          onOpenChatGpt={handleOpenChatGpt}
        />
      )}
    </div>
  )
}
