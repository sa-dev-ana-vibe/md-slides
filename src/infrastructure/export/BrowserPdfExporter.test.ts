import { describe, expect, it, vi } from 'vitest'
import { BrowserPdfExporter } from './BrowserPdfExporter'

describe('BrowserPdfExporter', () => {
  it('opens print window and prints rendered deck', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '.deck{}', slideCount: 1 }))
    }

    const openWindow = vi.fn()
    const documentOpen = vi.fn()
    const write = vi.fn()
    const close = vi.fn()
    const focus = vi.fn()
    const print = vi.fn()

    openWindow.mockReturnValue({
      document: { open: documentOpen, write, close },
      focus,
      print
    })

    const exporter = new BrowserPdfExporter({ renderer, openWindow })

    await exporter.export('# title')

    expect(renderer.render).toHaveBeenCalledWith('# title')
    expect(openWindow).toHaveBeenCalledWith('', '_blank', 'noopener,noreferrer')
    expect(openWindow).toHaveBeenCalledTimes(1)
    expect(documentOpen).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledTimes(1)
    expect(String(write.mock.calls[0][0])).toContain('<div>slides</div>')
    expect(close).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('throws when popup could not be opened', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const exporter = new BrowserPdfExporter({ renderer, openWindow: () => null })

    await expect(exporter.export('# title')).rejects.toThrow('Unable to open print window. Please allow popups and try again.')
  })

  it('supports default window.open dependency', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const popup = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn()
    }

    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const exporter = new BrowserPdfExporter({ renderer })

    await exporter.export('# test')

    expect(openSpy).toHaveBeenCalledWith('', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })
})
