import { cleanup, render, screen } from '@testing-library/react'
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

describe('PresentationOverlay', () => {
  afterEach(() => {
    cleanup()
  })

  it('attempts to request fullscreen on mount', () => {
    const requestFullscreen = vi.fn(async () => undefined)
    const restore = definePrototypeValue(HTMLElement.prototype, 'requestFullscreen', requestFullscreen)

    render(<PresentationOverlay documentHtml="<html></html>" channelId="presentation-1" onExit={vi.fn()} />)

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    restore()
  })

  it('renders even when fullscreen request fails', () => {
    const requestFullscreen = vi.fn(async () => {
      throw new Error('denied')
    })
    const restore = definePrototypeValue(HTMLElement.prototype, 'requestFullscreen', requestFullscreen)

    render(<PresentationOverlay documentHtml="<html></html>" channelId="presentation-1" onExit={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Presentation mode' })).toBeInTheDocument()
    expect(screen.getByTitle('Slides presentation')).toBeInTheDocument()
    restore()
  })

  it('exits when receiving matching postMessage', () => {
    const onExit = vi.fn()

    render(<PresentationOverlay documentHtml="<html></html>" channelId="presentation-7" onExit={onExit} />)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: PRESENTATION_MESSAGE_SOURCE,
          type: 'exit',
          channelId: 'presentation-7'
        }
      })
    )

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('ignores non-matching postMessage payloads', () => {
    const onExit = vi.fn()

    render(<PresentationOverlay documentHtml="<html></html>" channelId="presentation-7" onExit={onExit} />)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: PRESENTATION_MESSAGE_SOURCE,
          type: 'exit',
          channelId: 'presentation-999'
        }
      })
    )
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'other-source',
          type: 'exit',
          channelId: 'presentation-7'
        }
      })
    )

    expect(onExit).not.toHaveBeenCalled()
  })

  it('exits fullscreen on unmount when overlay is active fullscreen element', () => {
    const requestFullscreen = vi.fn(async () => undefined)
    const exitFullscreen = vi.fn(async () => undefined)
    const restoreRequest = definePrototypeValue(HTMLElement.prototype, 'requestFullscreen', requestFullscreen)
    const restoreExit = definePrototypeValue(document, 'exitFullscreen', exitFullscreen)

    const { unmount, container } = render(
      <PresentationOverlay documentHtml="<html></html>" channelId="presentation-7" onExit={vi.fn()} />
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
