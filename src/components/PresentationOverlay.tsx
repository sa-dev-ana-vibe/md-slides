import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { asPresentationExitMessage } from '../infrastructure/presentation/messages'

interface PresentationOverlayProps {
  documentHtml: string
  channelId: string
  onExit: () => void
}

export function PresentationOverlay({ documentHtml, channelId, onExit }: PresentationOverlayProps) {
  const { messages } = useI18n()
  const overlayRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const overlayElement = overlayRef.current

    if (!overlayElement || typeof overlayElement.requestFullscreen !== 'function') {
      return
    }

    try {
      void overlayElement.requestFullscreen().catch(() => undefined)
    } catch {
      // Ignore fullscreen request failures and keep viewport overlay enabled.
    }
  }, [])

  useEffect(() => {
    const overlayElement = overlayRef.current

    return () => {
      if (!overlayElement || typeof document.exitFullscreen !== 'function') {
        return
      }

      if (document.fullscreenElement !== overlayElement) {
        return
      }

      try {
        void document.exitFullscreen().catch(() => undefined)
      } catch {
        // Ignore fullscreen exit failures during teardown.
      }
    }
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const exitMessage = asPresentationExitMessage(event.data)

      if (!exitMessage) {
        return
      }

      if (exitMessage.channelId !== channelId) {
        return
      }

      onExit()
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [channelId, onExit])

  const handleHostEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') {
      return
    }

    event.preventDefault()
    onExit()
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={messages.presentationModeLabel}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      onKeyDown={handleHostEscape}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/20 bg-black/80 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/80">{messages.presentationModeLabel}</span>
        <button
          type="button"
          className="rounded-md bg-white/15 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          onClick={onExit}
        >
          {messages.exitPresentation}
        </button>
      </div>
      <iframe title={messages.slidesPresentation} srcDoc={documentHtml} className="h-full w-full flex-1 border-0 bg-black" sandbox="allow-scripts" />
    </div>
  )
}
