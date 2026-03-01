import PptxGenJS from 'pptxgenjs'
import type { PptxExporter, SlidesRenderer } from '../../domain/services'
import type { RenderResult } from '../../domain/types'

interface PptxSlideLike {
  addImage(options: { data: string; x: number; y: number; w: number; h: number }): void
}

interface PptxPresentationLike {
  layout: string
  addSlide(): PptxSlideLike
  writeFile(options: { fileName: string }): Promise<void> | void
}

interface SlideSvg {
  svg: string
  width: number
  height: number
}

interface BrowserPptxExporterDeps {
  renderer: SlidesRenderer
  createPresentation?: () => PptxPresentationLike
  convertSvgToPng?: (svg: string, width: number, height: number) => Promise<string>
}

const SLIDE_WIDTH_INCHES = 13.333
const SLIDE_HEIGHT_INCHES = 7.5

export function extractSlidesFromRender(rendered: RenderResult): SlideSvg[] {
  const parser = new DOMParser()
  const documentFragment = parser.parseFromString(rendered.html, 'text/html')
  const slides = Array.from(documentFragment.querySelectorAll('svg[data-marpit-svg]'))

  return slides.map((slide) => {
    const clone = slide.cloneNode(true) as SVGElement
    clone.querySelectorAll('script').forEach((node) => node.remove())

    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }

    const styleNode = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleNode.textContent = rendered.css
    clone.prepend(styleNode)

    const viewBox = (clone.getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number)
    const width = Number.isFinite(viewBox[2]) ? viewBox[2] : 1280
    const height = Number.isFinite(viewBox[3]) ? viewBox[3] : 720

    const xml = new XMLSerializer().serializeToString(clone)

    return { svg: xml, width, height }
  })
}

export async function defaultConvertSvgToPng(svg: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')

        if (!context) {
          throw new Error('Canvas 2D context is unavailable.')
        }

        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to render slide image for PowerPoint export.'))
    }

    image.src = objectUrl
  })
}

export class BrowserPptxExporter implements PptxExporter {
  private readonly renderer: SlidesRenderer
  private readonly createPresentation: () => PptxPresentationLike
  private readonly convertSvgToPng: (svg: string, width: number, height: number) => Promise<string>

  constructor({
    renderer,
    createPresentation = () => new PptxGenJS() as unknown as PptxPresentationLike,
    convertSvgToPng = defaultConvertSvgToPng
  }: BrowserPptxExporterDeps) {
    this.renderer = renderer
    this.createPresentation = createPresentation
    this.convertSvgToPng = convertSvgToPng
  }

  async export(markdown: string, fileName = 'deck.pptx'): Promise<void> {
    const rendered = this.renderer.render(markdown)
    const slides = extractSlidesFromRender(rendered)

    if (slides.length === 0) {
      throw new Error('There are no slides to export.')
    }

    const presentation = this.createPresentation()
    presentation.layout = 'LAYOUT_WIDE'

    for (const slideSvg of slides) {
      const pngDataUrl = await this.convertSvgToPng(slideSvg.svg, slideSvg.width, slideSvg.height)
      const slide = presentation.addSlide()
      slide.addImage({
        data: pngDataUrl,
        x: 0,
        y: 0,
        w: SLIDE_WIDTH_INCHES,
        h: SLIDE_HEIGHT_INCHES
      })
    }

    await presentation.writeFile({ fileName })
  }
}
