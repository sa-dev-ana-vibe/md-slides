import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { buildPresentationSlideHtml } from '../infrastructure/export/buildStandaloneHtml'
import { asPresentationMessage, type PresentationNavigateAction } from '../infrastructure/presentation/messages'

interface PresentationOverlayProps {
  slidesHtml: string[]
  css: string
  channelId: string
  onExit: () => void
}

function clampIndex(index: number, maxIndex: number): number {
  return Math.min(Math.max(index, 0), maxIndex)
}

export function PresentationOverlay({ slidesHtml, css, channelId, onExit }: PresentationOverlayProps) {
  const { messages } = useI18n()
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const maxSlideIndex = Math.max(slidesHtml.length - 1, 0)

  const navigate = useCallback((action: PresentationNavigateAction) => {
    setCurrentSlideIndex((currentIndex) => {
      switch (action) {
        case 'previous':
          return clampIndex(currentIndex - 1, maxSlideIndex)
        case 'next':
          return clampIndex(currentIndex + 1, maxSlideIndex)
        case 'first':
          return 0
        case 'last':
          return maxSlideIndex
      }
    })
  }, [maxSlideIndex])

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
      const presentationMessage = asPresentationMessage(event.data)

      if (!presentationMessage) {
        return
      }

      if (presentationMessage.channelId !== channelId) {
        return
      }

      if (presentationMessage.type === 'exit') {
        onExit()
        return
      }

      navigate(presentationMessage.action)
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [channelId, navigate, onExit])

  useEffect(() => {
    const nextKeys = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'])
    const previousKeys = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'])

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        navigate('first')
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        navigate('last')
        return
      }

      if (nextKeys.has(event.key)) {
        event.preventDefault()
        navigate('next')
        return
      }

      if (previousKeys.has(event.key)) {
        event.preventDefault()
        navigate('previous')
      }
    }

    window.addEventListener('keydown', onWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', onWindowKeyDown)
    }
  }, [navigate, onExit])

  const handleHostEscape = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') {
      return
    }

    event.preventDefault()
    onExit()
  }

  const effectiveSlideIndex = clampIndex(currentSlideIndex, maxSlideIndex)
  const currentSlideHtml = slidesHtml[effectiveSlideIndex] ?? ''
  const iframeDocumentHtml = useMemo(
    () => buildPresentationSlideHtml(currentSlideHtml, css, messages.presentationModeLabel, { channelId }),
    [channelId, css, currentSlideHtml, messages.presentationModeLabel]
  )
  const totalSlides = slidesHtml.length
  const currentSlideNumber = totalSlides === 0 ? 0 : effectiveSlideIndex + 1

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
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/80">{messages.presentationModeLabel}</span>
          <span className="text-xs text-white/70">{`${currentSlideNumber} / ${totalSlides}`}</span>
        </div>
        <button
          type="button"
          className="rounded-md bg-white/15 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          onClick={onExit}
        >
          {messages.exitPresentation}
        </button>
      </div>
      <iframe title={messages.slidesPresentation} srcDoc={iframeDocumentHtml} className="h-full w-full flex-1 border-0 bg-black" sandbox="allow-scripts" />
    </div>
  )
}
