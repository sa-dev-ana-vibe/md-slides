import type { PdfExporter, SlidesRenderer } from '../../domain/services'
import { buildStandaloneHtml } from './buildStandaloneHtml'

interface PrintableWindow {
  document: {
    open: () => void
    write: (content: string) => void
    close: () => void
  }
  focus?: () => void
  print: () => void
}

interface BrowserPdfExporterDeps {
  renderer: SlidesRenderer
  openWindow?: (url?: string, target?: string, features?: string) => PrintableWindow | null
}

export class BrowserPdfExporter implements PdfExporter {
  private readonly renderer: SlidesRenderer
  private readonly openWindow: (url?: string, target?: string, features?: string) => PrintableWindow | null

  constructor({
    renderer,
    openWindow = (url, target, features) => window.open(url, target, features) as PrintableWindow | null
  }: BrowserPdfExporterDeps) {
    this.renderer = renderer
    this.openWindow = openWindow
  }

  async export(markdown: string): Promise<void> {
    const rendered = this.renderer.render(markdown)
    const standaloneHtml = buildStandaloneHtml(rendered, 'MD Slides PDF Export')

    const printWindow = this.openWindow('', '_blank', 'noopener,noreferrer')

    if (!printWindow) {
      throw new Error('Unable to open print window. Please allow popups and try again.')
    }

    printWindow.document.open()
    printWindow.document.write(standaloneHtml)
    printWindow.document.close()
    printWindow.focus?.()
    printWindow.print()
  }
}
