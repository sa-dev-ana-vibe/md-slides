import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './diagnostics'
import { BrowserPdfExporter } from './BrowserPdfExporter'

type PrintLifecycleEvent = 'beforeprint' | 'afterprint'
type LifecycleListener = () => void
type MessageListener = (event: { data: unknown }) => void

function createLifecycleTarget() {
  const listeners: Record<PrintLifecycleEvent, Set<LifecycleListener>> = {
    beforeprint: new Set(),
    afterprint: new Set()
  }

  const addEventListener = vi.fn((event: PrintLifecycleEvent, listener: LifecycleListener) => {
    listeners[event].add(listener)
  })

  const removeEventListener = vi.fn((event: PrintLifecycleEvent, listener: LifecycleListener) => {
    listeners[event].delete(listener)
  })

  const dispatch = (event: PrintLifecycleEvent) => {
    for (const listener of Array.from(listeners[event])) {
      listener()
    }
  }

  const listenerCount = (event: PrintLifecycleEvent): number => listeners[event].size

  return {
    addEventListener,
    removeEventListener,
    dispatch,
    listenerCount
  }
}

function createMessageTarget() {
  const listeners = new Set<MessageListener>()

  return {
    addEventListener: vi.fn((event: 'message', listener: MessageListener) => {
      if (event === 'message') {
        listeners.add(listener)
      }
    }),
    removeEventListener: vi.fn((event: 'message', listener: MessageListener) => {
      if (event === 'message') {
        listeners.delete(listener)
      }
    }),
    dispatch: (data: unknown) => {
      for (const listener of Array.from(listeners)) {
        listener({ data })
      }
    },
    listenerCount: () => listeners.size
  }
}

function createPrintableIframe(contentWindow: unknown) {
  return {
    style: {} as Partial<CSSStyleDeclaration>,
    srcdoc: '',
    contentWindow,
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    remove: vi.fn()
  }
}

describe('BrowserPdfExporter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('prints deck through hidden iframe and cleans up listeners', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '.deck{}', slideCount: 1 }))
    }

    const hostWindow = createLifecycleTarget()
    const messageTarget = createMessageTarget()
    const frameWindowTarget = createLifecycleTarget()
    const frameWindow = {
      ...frameWindowTarget,
      focus: vi.fn(),
      print: vi.fn(() => {
        frameWindowTarget.dispatch('beforeprint')
        frameWindowTarget.dispatch('beforeprint')
        frameWindowTarget.dispatch('afterprint')
      })
    }

    const iframe = createPrintableIframe(frameWindow)
    const appendChild = vi.fn((node: typeof iframe) => {
      node.onload?.()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: { appendChild: appendChild as never }
      },
      hostWindow: hostWindow as never,
      hostMessageTarget: messageTarget as never,
      frameLoadTimeoutMs: 100,
      printStartTimeoutMs: 100,
      printCloseTimeoutMs: 100
    })

    await exporter.export('# title')

    expect(renderer.render).toHaveBeenCalledWith('# title')
    expect(appendChild).toHaveBeenCalledWith(iframe)
    expect(iframe.srcdoc).toContain('<div>slides</div>')
    expect(frameWindow.focus).toHaveBeenCalledTimes(1)
    expect(frameWindow.print).toHaveBeenCalledTimes(1)
    expect(iframe.remove).toHaveBeenCalledTimes(1)
    expect(frameWindowTarget.listenerCount('beforeprint')).toBe(0)
    expect(frameWindowTarget.listenerCount('afterprint')).toBe(0)
    expect(hostWindow.listenerCount('beforeprint')).toBe(0)
    expect(hostWindow.listenerCount('afterprint')).toBe(0)
    expect(messageTarget.listenerCount()).toBe(0)
  })

  it('handles afterprint-only lifecycle events', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const frameWindowTarget = createLifecycleTarget()
    const frameWindow = {
      ...frameWindowTarget,
      focus: vi.fn(),
      print: vi.fn(() => {
        frameWindowTarget.dispatch('afterprint')
      })
    }

    const iframe = createPrintableIframe(frameWindow)
    const appendChild = vi.fn((node: typeof iframe) => {
      node.onload?.()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: {
          appendChild: appendChild as never
        }
      },
      frameLoadTimeoutMs: 100,
      printStartTimeoutMs: 100,
      printCloseTimeoutMs: 100
    })

    await exporter.export('# title')

    expect(frameWindow.print).toHaveBeenCalledTimes(1)
    expect(iframe.remove).toHaveBeenCalledTimes(1)
  })

  it('fails with diagnostics error from print frame', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const messageTarget = createMessageTarget()
    let diagnosticsChannelId = ''

    const frameWindowTarget = createLifecycleTarget()
    const frameWindow = {
      ...frameWindowTarget,
      focus: vi.fn(),
      print: vi.fn(() => {
        messageTarget.dispatch({
          source: DIAGNOSTICS_MESSAGE_SOURCE,
          channelId: diagnosticsChannelId,
          type: 'error',
          message: 'GET https://marp.app/assets/marp.svg net::ERR_CONNECTION_CLOSED'
        })
      })
    }

    const iframe = createPrintableIframe(frameWindow)
    const appendChild = vi.fn((node: typeof iframe) => {
      const match = node.srcdoc.match(/DIAGNOSTICS_CHANNEL_ID = ([^;]+);/)

      if (!match) {
        throw new Error('Missing diagnostics channel id in print frame html.')
      }

      diagnosticsChannelId = JSON.parse(match[1]) as string
      node.onload?.()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: { appendChild: appendChild as never }
      },
      hostMessageTarget: messageTarget as never,
      frameLoadTimeoutMs: 100,
      printStartTimeoutMs: 100,
      printCloseTimeoutMs: 100
    })

    await expect(exporter.export('# title')).rejects.toThrow(
      'GET https://marp.app/assets/marp.svg net::ERR_CONNECTION_CLOSED'
    )
    expect(iframe.remove).toHaveBeenCalledTimes(1)
    expect(messageTarget.listenerCount()).toBe(0)
  })

  it('throws when iframe host document has no body', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const exporter = new BrowserPdfExporter({
      renderer,
      hostDocument: {
        body: null
      }
    })

    await expect(exporter.export('# title')).rejects.toThrow('Unable to render print frame in this document.')
  })

  it('fails when iframe does not load before timeout', async () => {
    vi.useFakeTimers()

    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const iframe = createPrintableIframe({
      ...createLifecycleTarget(),
      focus: vi.fn(),
      print: vi.fn()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: {
          appendChild: vi.fn()
        }
      },
      frameLoadTimeoutMs: 20
    })

    const exportPromise = exporter.export('# title')
    const rejection = expect(exportPromise).rejects.toThrow('Timed out waiting for print frame to load.')
    await vi.advanceTimersByTimeAsync(21)
    await rejection
    expect(iframe.remove).toHaveBeenCalledTimes(1)
  })

  it('fails when print dialog does not start', async () => {
    vi.useFakeTimers()

    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const hostWindow = createLifecycleTarget()
    const frameWindowTarget = createLifecycleTarget()
    const frameWindow = {
      ...frameWindowTarget,
      focus: vi.fn(),
      print: vi.fn()
    }

    const iframe = createPrintableIframe(frameWindow)
    const appendChild = vi.fn((node: typeof iframe) => {
      node.onload?.()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: {
          appendChild: appendChild as never
        }
      },
      hostWindow: hostWindow as never,
      frameLoadTimeoutMs: 20,
      printStartTimeoutMs: 30,
      printCloseTimeoutMs: 50
    })

    const exportPromise = exporter.export('# title')
    const rejection = expect(exportPromise).rejects.toThrow('Print dialog did not start.')
    await vi.advanceTimersByTimeAsync(31)
    await rejection
    expect(iframe.remove).toHaveBeenCalledTimes(1)
    expect(frameWindowTarget.listenerCount('beforeprint')).toBe(0)
    expect(frameWindowTarget.listenerCount('afterprint')).toBe(0)
    expect(hostWindow.listenerCount('beforeprint')).toBe(0)
    expect(hostWindow.listenerCount('afterprint')).toBe(0)
  })

  it('fails when print dialog does not close before timeout', async () => {
    vi.useFakeTimers()

    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const frameWindowTarget = createLifecycleTarget()
    const frameWindow = {
      ...frameWindowTarget,
      focus: vi.fn(),
      print: vi.fn(() => {
        frameWindowTarget.dispatch('beforeprint')
      })
    }

    const iframe = createPrintableIframe(frameWindow)
    const appendChild = vi.fn((node: typeof iframe) => {
      node.onload?.()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: {
          appendChild: appendChild as never
        }
      },
      frameLoadTimeoutMs: 20,
      printStartTimeoutMs: 30,
      printCloseTimeoutMs: 40
    })

    const exportPromise = exporter.export('# title')
    const rejection = expect(exportPromise).rejects.toThrow('Timed out waiting for print dialog to close.')
    await vi.advanceTimersByTimeAsync(41)
    await rejection
    expect(iframe.remove).toHaveBeenCalledTimes(1)
  })

  it('fails when iframe contentWindow is unavailable', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const iframe = createPrintableIframe(null)
    const appendChild = vi.fn((node: typeof iframe) => {
      node.onload?.()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: {
          appendChild: appendChild as never
        }
      }
    })

    await expect(exporter.export('# title')).rejects.toThrow('Unable to access print frame window.')
    expect(iframe.remove).toHaveBeenCalledTimes(1)
  })

  it('fails when print throws and still cleans up', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const hostWindow = createLifecycleTarget()
    const frameWindowTarget = createLifecycleTarget()
    const frameWindow = {
      ...frameWindowTarget,
      focus: vi.fn(),
      print: vi.fn(() => {
        throw new Error('print crashed')
      })
    }

    const iframe = createPrintableIframe(frameWindow)
    const appendChild = vi.fn((node: typeof iframe) => {
      node.onload?.()
    })

    const exporter = new BrowserPdfExporter({
      renderer,
      createIframe: () => iframe as never,
      hostDocument: {
        body: {
          appendChild: appendChild as never
        }
      },
      hostWindow: hostWindow as never
    })

    await expect(exporter.export('# title')).rejects.toThrow('print crashed')
    expect(iframe.remove).toHaveBeenCalledTimes(1)
    expect(frameWindowTarget.listenerCount('beforeprint')).toBe(0)
    expect(frameWindowTarget.listenerCount('afterprint')).toBe(0)
    expect(hostWindow.listenerCount('beforeprint')).toBe(0)
    expect(hostWindow.listenerCount('afterprint')).toBe(0)
  })
})
