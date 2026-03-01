import { describe, expect, it, vi } from 'vitest'
import { BrowserPptxExporter, defaultConvertSvgToPng, extractSlidesFromRender } from './BrowserPptxExporter'

describe('extractSlidesFromRender', () => {
  it('extracts slides with dimensions and inlined styles', () => {
    const slides = extractSlidesFromRender({
      html: '<div><svg data-marpit-svg="" viewBox="0 0 1280 720"><script>bad()</script><foreignObject><section>Slide</section></foreignObject></svg></div>',
      css: 'section{color:red;}',
      slideCount: 1
    })

    expect(slides).toHaveLength(1)
    expect(slides[0].width).toBe(1280)
    expect(slides[0].height).toBe(720)
    expect(slides[0].svg).toContain('section{color:red;}')
    expect(slides[0].svg).not.toContain('<script>')
  })

  it('falls back to default dimensions when viewBox is absent', () => {
    const slides = extractSlidesFromRender({
      html: '<div><svg data-marpit-svg=""><foreignObject><section>Slide</section></foreignObject></svg></div>',
      css: '',
      slideCount: 1
    })

    expect(slides[0].width).toBe(1280)
    expect(slides[0].height).toBe(720)
  })
})

describe('BrowserPptxExporter', () => {
  it('builds a pptx with all rendered slides', async () => {
    const renderer = {
      render: vi.fn(() => ({
        html: '<div><svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject><section>One</section></foreignObject></svg><svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject><section>Two</section></foreignObject></svg></div>',
        css: '.slide{}',
        slideCount: 2
      }))
    }

    const addImage = vi.fn()
    const addSlide = vi.fn(() => ({ addImage }))
    const writeFile = vi.fn(async () => undefined)
    const presentation = { layout: '', addSlide, writeFile }

    const convertSvgToPng = vi.fn(async (svg: string, width: number, height: number) => {
      return `data:image/png;base64,${width}x${height}:${svg.length}`
    })

    const exporter = new BrowserPptxExporter({
      renderer,
      createPresentation: () => presentation,
      convertSvgToPng
    })

    await exporter.export('# deck', 'deck.pptx')

    expect(renderer.render).toHaveBeenCalledWith('# deck')
    expect(presentation.layout).toBe('LAYOUT_WIDE')
    expect(addSlide).toHaveBeenCalledTimes(2)
    expect(addImage).toHaveBeenCalledTimes(2)
    expect(writeFile).toHaveBeenCalledWith({ fileName: 'deck.pptx' })
  })

  it('throws when no slides were generated', async () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div></div>', css: '', slideCount: 0 }))
    }

    const exporter = new BrowserPptxExporter({
      renderer,
      createPresentation: () => ({ layout: '', addSlide: vi.fn(), writeFile: vi.fn() }),
      convertSvgToPng: vi.fn(async () => 'data:image/png;base64,abc')
    })

    await expect(exporter.export('# deck')).rejects.toThrow('There are no slides to export.')
  })

  it('propagates converter failures', async () => {
    const renderer = {
      render: vi.fn(() => ({
        html: '<div><svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject><section>One</section></foreignObject></svg></div>',
        css: '',
        slideCount: 1
      }))
    }

    const exporter = new BrowserPptxExporter({
      renderer,
      createPresentation: () => ({
        layout: '',
        addSlide: () => ({ addImage: vi.fn() }),
        writeFile: vi.fn(async () => undefined)
      }),
      convertSvgToPng: vi.fn(async () => {
        throw new Error('conversion failed')
      })
    })

    await expect(exporter.export('# deck')).rejects.toThrow('conversion failed')
  })

  it('can be constructed with default presentation factory', () => {
    const renderer = {
      render: vi.fn(() => ({ html: '<div></div>', css: '', slideCount: 0 }))
    }

    const exporter = new BrowserPptxExporter({
      renderer,
      convertSvgToPng: vi.fn(async () => 'data:image/png;base64,abc')
    })

    expect(exporter).toBeInstanceOf(BrowserPptxExporter)
  })
})

describe('defaultConvertSvgToPng', () => {
  it('converts svg to png data url', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const drawImage = vi.fn()
    const getContext = vi.fn(() => ({ drawImage }))
    const toDataURL = vi.fn(() => 'data:image/png;base64,ok')
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        return { width: 0, height: 0, getContext, toDataURL } as unknown as HTMLCanvasElement
      }

      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName)
    })

    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_: string) {
        this.onload?.()
      }
    }

    const originalImage = globalThis.Image
    globalThis.Image = FakeImage as unknown as typeof Image

    await expect(defaultConvertSvgToPng('<svg></svg>', 1280, 720)).resolves.toBe('data:image/png;base64,ok')
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(drawImage).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:svg')

    globalThis.Image = originalImage
    createElementSpy.mockRestore()
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })

  it('throws when canvas context is unavailable', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg-no-context')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        return { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement
      }

      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName)
    })

    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_: string) {
        this.onload?.()
      }
    }

    const originalImage = globalThis.Image
    globalThis.Image = FakeImage as unknown as typeof Image

    await expect(defaultConvertSvgToPng('<svg></svg>', 1280, 720)).rejects.toThrow('Canvas 2D context is unavailable.')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:svg-no-context')

    globalThis.Image = originalImage
    createElementSpy.mockRestore()
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })

  it('throws when image loading fails', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg-error')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_: string) {
        this.onerror?.()
      }
    }

    const originalImage = globalThis.Image
    globalThis.Image = FakeImage as unknown as typeof Image

    await expect(defaultConvertSvgToPng('<svg></svg>', 1280, 720)).rejects.toThrow(
      'Failed to render slide image for PowerPoint export.'
    )
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:svg-error')

    globalThis.Image = originalImage
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })
})
