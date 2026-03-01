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

export interface PptxExporter {
  export(markdown: string, fileName?: string): Promise<void>
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
  pptxExporter: PptxExporter
  importer: MarkdownFileImporter
  confirm: ConfirmService
  beforeUnload: BeforeUnloadGuard
}
