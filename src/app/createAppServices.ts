import type { AppServices } from '../domain/services'
import { MarpCoreSlidesRenderer } from '../infrastructure/marp/MarpCoreSlidesRenderer'
import { BrowserHtmlExporter } from '../infrastructure/export/BrowserHtmlExporter'
import { BrowserPdfExporter } from '../infrastructure/export/BrowserPdfExporter'
import { BrowserSlidesDiagnosticsInspector } from '../infrastructure/export/BrowserSlidesDiagnosticsInspector'
import { BrowserMarkdownFileImporter } from '../infrastructure/file/BrowserMarkdownFileImporter'
import { WindowConfirmService } from '../infrastructure/browser/WindowConfirmService'
import { WindowBeforeUnloadGuard } from '../infrastructure/browser/WindowBeforeUnloadGuard'

export function createAppServices(overrides: Partial<AppServices> = {}): AppServices {
  const renderer = overrides.renderer ?? new MarpCoreSlidesRenderer()
  const diagnosticsInspector = overrides.diagnosticsInspector ?? new BrowserSlidesDiagnosticsInspector()

  return {
    renderer,
    htmlExporter: overrides.htmlExporter ?? new BrowserHtmlExporter({ renderer }),
    pdfExporter: overrides.pdfExporter ?? new BrowserPdfExporter({ renderer, diagnosticsInspector }),
    diagnosticsInspector,
    importer: overrides.importer ?? new BrowserMarkdownFileImporter(),
    confirm: overrides.confirm ?? new WindowConfirmService(),
    beforeUnload: overrides.beforeUnload ?? new WindowBeforeUnloadGuard()
  }
}
