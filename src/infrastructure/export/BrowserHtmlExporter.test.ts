import { describe, expect, it, vi } from 'vitest'
import { BrowserHtmlExporter } from './BrowserHtmlExporter'

describe('BrowserHtmlExporter', () => {
  it('renders and downloads standalone html', () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: 'body{}', slideCount: 1 }))
    }

    const createBlob = vi.fn((parts: BlobPart[], options?: BlobPropertyBag) => new Blob(parts, options))
    const createObjectURL = vi.fn(() => 'blob:deck')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement

    const exporter = new BrowserHtmlExporter({
      renderer,
      createBlob,
      createObjectURL,
      revokeObjectURL,
      createAnchor: () => anchor
    })

    exporter.export('# deck', 'slides.html')

    expect(renderer.render).toHaveBeenCalledWith('# deck')
    expect(createBlob).toHaveBeenCalled()
    expect(anchor.href).toBe('blob:deck')
    expect(anchor.download).toBe('slides.html')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:deck')
  })

  it('uses default file name', () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const click = vi.fn()
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement

    const exporter = new BrowserHtmlExporter({
      renderer,
      createObjectURL: () => 'blob:default',
      revokeObjectURL: vi.fn(),
      createAnchor: () => anchor
    })

    exporter.export('# default')

    expect(anchor.download).toBe('deck.html')
  })

  it('supports default browser dependencies', () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div>slides</div>', css: '', slideCount: 1 }))
    }

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:browser-default')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    const exporter = new BrowserHtmlExporter({ renderer })
    exporter.export('# browser-default')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:browser-default')
    expect(clickSpy).toHaveBeenCalledTimes(1)

    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    clickSpy.mockRestore()
  })
})
