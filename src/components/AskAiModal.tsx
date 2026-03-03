import { useEffect } from 'react'
import { useI18n } from '../i18n/I18nContext'
import type { SizePreset, TargetSlideVibe } from '../infrastructure/prompt/buildAskAiPrompt'

interface AskAiModalProps {
  themeNames: readonly string[]
  userBrief: string
  themeName: string
  includePresenterNotes: boolean
  targetSlideCount: TargetSlideVibe
  sizePreset: SizePreset
  onUserBriefChange: (value: string) => void
  onThemeNameChange: (value: string) => void
  onIncludePresenterNotesChange: (value: boolean) => void
  onTargetSlideCountChange: (value: TargetSlideVibe) => void
  onSizePresetChange: (value: SizePreset) => void
  onClose: () => void
  onCopyPrompt: () => void
  onOpenChatGpt: () => void
}

export function AskAiModal({
  themeNames,
  userBrief,
  themeName,
  includePresenterNotes,
  targetSlideCount,
  sizePreset,
  onUserBriefChange,
  onThemeNameChange,
  onIncludePresenterNotesChange,
  onTargetSlideCountChange,
  onSizePresetChange,
  onClose,
  onCopyPrompt,
  onOpenChatGpt
}: AskAiModalProps) {
  const { messages } = useI18n()

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', onWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', onWindowKeyDown)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={messages.askAiModalTitle}
        className="flex h-full max-h-[780px] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{messages.askAiModalTitle}</h2>
          <button
            type="button"
            className="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            onClick={onClose}
          >
            {messages.askAiClose}
          </button>
        </div>

        <div className="grid h-full flex-1 gap-4 overflow-auto p-5 lg:grid-cols-[2fr_1fr]">
          <div className="flex h-full min-h-[320px] flex-col gap-2">
            <label htmlFor="ask-ai-user-brief" className="text-sm font-medium text-slate-700">
              {messages.askAiBriefLabel}
            </label>
            <textarea
              id="ask-ai-user-brief"
              className="h-full min-h-[420px] w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              placeholder={messages.askAiBriefPlaceholder}
              value={userBrief}
              onChange={(event) => onUserBriefChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">{messages.askAiThemeLabel}</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
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

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={includePresenterNotes}
                onChange={(event) => onIncludePresenterNotesChange(event.target.checked)}
              />
              <span>{messages.askAiIncludePresenterNotesLabel}</span>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">{messages.askAiTargetSlideCountLabel}</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                value={targetSlideCount}
                onChange={(event) => onTargetSlideCountChange(event.target.value as TargetSlideVibe)}
              >
                <option value="small">{messages.askAiTargetSlideCountSmall}</option>
                <option value="medium">{messages.askAiTargetSlideCountMedium}</option>
                <option value="large">{messages.askAiTargetSlideCountLarge}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">{messages.askAiSizePresetLabel}</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                value={sizePreset}
                onChange={(event) => onSizePresetChange(event.target.value as SizePreset)}
              >
                <option value="">{messages.askAiSizePresetOmit}</option>
                <option value="16:9">16:9</option>
                <option value="4:3">4:3</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            onClick={onClose}
          >
            {messages.askAiCancel}
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            onClick={onCopyPrompt}
          >
            {messages.askAiCopyPrompt}
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            onClick={onOpenChatGpt}
          >
            {messages.askAiOpenChatGpt}
          </button>
        </div>
      </div>
    </div>
  )
}
