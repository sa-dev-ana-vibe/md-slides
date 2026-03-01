export type ExportFormat = 'html' | 'pdf' | 'pptx'

export interface RenderResult {
  html: string
  css: string
  slideCount: number
}
