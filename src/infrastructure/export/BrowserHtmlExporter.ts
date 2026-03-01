import type { HtmlExporter, SlidesRenderer } from '../../domain/services'
import { buildStandaloneHtml } from './buildStandaloneHtml'

interface BrowserHtmlExporterDeps {
  renderer: SlidesRenderer
  createBlob?: (parts: BlobPart[], options?: BlobPropertyBag) => Blob
  createObjectURL?: (blob: Blob) => string
  revokeObjectURL?: (url: string) => void
  createAnchor?: () => HTMLAnchorElement
}

export class BrowserHtmlExporter implements HtmlExporter {
  private readonly renderer: SlidesRenderer
  private readonly createBlob: (parts: BlobPart[], options?: BlobPropertyBag) => Blob
  private readonly createObjectURL: (blob: Blob) => string
  private readonly revokeObjectURL: (url: string) => void
  private readonly createAnchor: () => HTMLAnchorElement

  constructor({
    renderer,
    createBlob = (parts, options) => new Blob(parts, options),
    createObjectURL = (blob) => URL.createObjectURL(blob),
    revokeObjectURL = (url) => URL.revokeObjectURL(url),
    createAnchor = () => document.createElement('a')
  }: BrowserHtmlExporterDeps) {
    this.renderer = renderer
    this.createBlob = createBlob
    this.createObjectURL = createObjectURL
    this.revokeObjectURL = revokeObjectURL
    this.createAnchor = createAnchor
  }

  export(markdown: string, fileName = 'deck.html'): void {
    const rendered = this.renderer.render(markdown)
    const standaloneHtml = buildStandaloneHtml(rendered)

    const blob = this.createBlob([standaloneHtml], { type: 'text/html;charset=utf-8' })
    const url = this.createObjectURL(blob)

    const anchor = this.createAnchor()
    anchor.href = url
    anchor.download = fileName
    anchor.click()

    this.revokeObjectURL(url)
  }
}
