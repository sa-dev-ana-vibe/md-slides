import type { RenderResult } from './types'

export interface SlidesRenderer {
  render(markdown: string): RenderResult
}

export interface HtmlExporter {
  export(markdown: string, fileName?: string): void
}

export interface PdfExporter {
  export(markdown: string): Promise<void>
}

export interface SlidesDiagnosticsInspector {
  inspect(renderResult: RenderResult): Promise<string[]>
}

export interface MarkdownFileImporter {
  pickAndRead(): Promise<string | null>
  readDropped(file: File): Promise<string>
}

export interface ConfirmService {
  confirm(message: string): boolean
}

export interface BeforeUnloadGuard {
  attach(shouldBlock: () => boolean): () => void
}

export interface AppServices {
  renderer: SlidesRenderer
  htmlExporter: HtmlExporter
  pdfExporter: PdfExporter
  diagnosticsInspector: SlidesDiagnosticsInspector
  importer: MarkdownFileImporter
  confirm: ConfirmService
  beforeUnload: BeforeUnloadGuard
}
