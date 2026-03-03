import { useI18n } from '../i18n/I18nContext'
import type { Ref } from 'react'
import type { SizePreset } from '../infrastructure/prompt/buildAskAiPrompt'

interface PreviewPaneProps {
  documentHtml: string
  slideCount: number
  themeNames: readonly string[]
  themeName: string
  sizePreset: SizePreset
  diagnosticErrors: string[]
  diagnosticsPending: boolean
  onThemeNameChange: (value: string) => void
  onSizePresetChange: (value: SizePreset) => void
  errorMessage?: string | null
  iframeRef?: Ref<HTMLIFrameElement>
}

export function PreviewPane({
  documentHtml,
  slideCount,
  themeNames,
  themeName,
  sizePreset,
  diagnosticErrors,
  diagnosticsPending,
  onThemeNameChange,
  onSizePresetChange,
  errorMessage,
  iframeRef
}: PreviewPaneProps) {
  const { messages } = useI18n()

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{messages.previewLabel}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-700">
            <span className="font-medium">{messages.askAiThemeLabel}</span>
            <select
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              value={themeName}
              onChange={(event) => onThemeNameChange(event.target.value)}
            >
              {themeNames.map((optionThemeName) => (
                <option key={optionThemeName} value={optionThemeName}>
                  {optionThemeName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-700">
            <span className="font-medium">{messages.askAiSizePresetLabel}</span>
            <select
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              value={sizePreset}
              onChange={(event) => onSizePresetChange(event.target.value as SizePreset)}
            >
              <option value="">{messages.askAiSizePresetOmit}</option>
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
            </select>
          </label>
          <span className="text-xs text-slate-500">{messages.slideCount(slideCount)}</span>
        </div>
      </div>
      {errorMessage ? (
        <div className="flex flex-1 items-center justify-center px-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </div>
      ) : (
        <>
          {diagnosticsPending && (
            <div className="border-b border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-900" role="status">
              {messages.previewDiagnosticsInProgress}
            </div>
          )}
          {diagnosticErrors.length > 0 && (
            <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
              <p className="font-semibold">{messages.previewIssuesDetected}</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {diagnosticErrors.map((error) => (
                  <li key={error} className="break-all">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {slideCount === 0 && (
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {messages.startTypingMarkdownToGenerateSlides}
            </div>
          )}
          <iframe
            ref={iframeRef}
            title={messages.slidesPreview}
            srcDoc={documentHtml}
            className="h-[420px] w-full flex-1 bg-slate-100"
            sandbox="allow-scripts"
          />
        </>
      )}
    </div>
  )
}
