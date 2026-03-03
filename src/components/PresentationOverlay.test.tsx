import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PresentationOverlay } from './PresentationOverlay'
import { PRESENTATION_MESSAGE_SOURCE } from '../infrastructure/presentation/messages'

function definePrototypeValue<T extends object, K extends PropertyKey>(
  target: T,
  key: K,
  value: unknown
): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, key)

  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value
  })

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(target, key, originalDescriptor)
      return
    }

    Reflect.deleteProperty(target, key)
  }
}

function renderOverlay(onExit = vi.fn()) {
  render(
    <PresentationOverlay
      slidesHtml={[
        '<svg data-marpit-svg="" id="slide-1"><foreignObject><section><h1>Slide 1</h1></section></foreignObject></svg>',
        '<svg data-marpit-svg="" id="slide-2"><foreignObject><section><h1>Slide 2</h1></section></foreignObject></svg>'
      ]}
      css=".marpit{}"
      channelId="presentation-7"
      onExit={onExit}
    />
  )

  return { onExit }
}

function getPresentationFrameWindow(): Window {
  const frame = screen.getByTitle<HTMLIFrameElement>('Slides presentation')

  if (!frame.contentWindow) {
    throw new Error('Unable to access slides presentation frame window.')
  }

  return frame.contentWindow
}

function dispatchOverlayMessage(data: unknown, source?: MessageEventSource | null): void {
  const resolvedSource = source === undefined ? getPresentationFrameWindow() : source

  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      source: resolvedSource
    })
  )
}

describe('PresentationOverlay', () => {
  afterEach(() => {
    cleanup()
  })

  it('attempts to request fullscreen on mount', () => {
    const requestFullscreen = vi.fn(async () => undefined)
    const restore = definePrototypeValue(HTMLElement.prototype, 'requestFullscreen', requestFullscreen)

    renderOverlay()

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    restore()
  })

  it('renders even when fullscreen request fails', () => {
    const requestFullscreen = vi.fn(async () => {
      throw new Error('denied')
    })
    const restore = definePrototypeValue(HTMLElement.prototype, 'requestFullscreen', requestFullscreen)

    renderOverlay()

    expect(screen.getByRole('dialog', { name: 'Presentation mode' })).toBeInTheDocument()
    expect(screen.getByTitle('Slides presentation')).toBeInTheDocument()
    restore()
  })

  it('navigates slides via presentation messages', async () => {
    renderOverlay()

    const frame = screen.getByTitle<HTMLIFrameElement>('Slides presentation')
    expect(frame.srcdoc).toContain('id="slide-1"')
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'next',
      channelId: 'presentation-7'
    })

    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-2"')
      expect(screen.getByText('2 / 2')).toBeInTheDocument()
    })

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'previous',
      channelId: 'presentation-7'
    })

    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-1"')
      expect(screen.getByText('1 / 2')).toBeInTheDocument()
    })
  })

  it('navigates slides with keyboard without iframe focus', async () => {
    renderOverlay()

    const frame = screen.getByTitle<HTMLIFrameElement>('Slides presentation')
    expect(frame.srcdoc).toContain('id="slide-1"')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))

    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-2"')
      expect(screen.getByText('2 / 2')).toBeInTheDocument()
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))

    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-1"')
      expect(screen.getByText('1 / 2')).toBeInTheDocument()
    })
  })

  it('clamps navigation boundaries', async () => {
    renderOverlay()

    const frame = screen.getByTitle<HTMLIFrameElement>('Slides presentation')

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'previous',
      channelId: 'presentation-7'
    })

    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-1"')
      expect(screen.getByText('1 / 2')).toBeInTheDocument()
    })

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'last',
      channelId: 'presentation-7'
    })
    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-2"')
      expect(screen.getByText('2 / 2')).toBeInTheDocument()
    })

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'next',
      channelId: 'presentation-7'
    })
    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-2"')
      expect(screen.getByText('2 / 2')).toBeInTheDocument()
    })

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'first',
      channelId: 'presentation-7'
    })
    await waitFor(() => {
      expect(frame.srcdoc).toContain('id="slide-1"')
      expect(screen.getByText('1 / 2')).toBeInTheDocument()
    })
  })

  it('exits when receiving matching exit message', () => {
    const { onExit } = renderOverlay()

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'exit',
      channelId: 'presentation-7'
    })

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('ignores non-matching postMessage payloads', () => {
    const { onExit } = renderOverlay()

    dispatchOverlayMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'exit',
      channelId: 'presentation-999'
    })
    dispatchOverlayMessage({
      source: 'other-source',
      type: 'exit',
      channelId: 'presentation-7'
    })

    expect(onExit).not.toHaveBeenCalled()
  })

  it('ignores postMessage payloads from unexpected message source', () => {
    const { onExit } = renderOverlay()

    dispatchOverlayMessage(
      {
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'exit',
        channelId: 'presentation-7'
      },
      window
    )

    expect(onExit).not.toHaveBeenCalled()
  })

  it('exits fullscreen on unmount when overlay is active fullscreen element', () => {
    const requestFullscreen = vi.fn(async () => undefined)
    const exitFullscreen = vi.fn(async () => undefined)
    const restoreRequest = definePrototypeValue(HTMLElement.prototype, 'requestFullscreen', requestFullscreen)
    const restoreExit = definePrototypeValue(document, 'exitFullscreen', exitFullscreen)

    const { unmount, container } = render(
      <PresentationOverlay
        slidesHtml={['<svg data-marpit-svg="" id="slide-1"></svg>']}
        css=".marpit{}"
        channelId="presentation-7"
        onExit={vi.fn()}
      />
    )

    const overlay = container.firstElementChild
    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => overlay
    })

    unmount()

    expect(exitFullscreen).toHaveBeenCalledTimes(1)

    if (fullscreenDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor)
    } else {
      Reflect.deleteProperty(document, 'fullscreenElement')
    }

    restoreRequest()
    restoreExit()
  })
})
