import { vi } from 'vitest'
import type { AppServices, BeforeUnloadGuard } from '../domain/services'
import type { RenderResult } from '../domain/types'

const defaultRenderResult = (markdown: string): RenderResult => ({
  html:
    markdown.trim().length > 0
      ? [
          `<svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject width="1280" height="720"><section><h1>${markdown}</h1></section></foreignObject></svg>`
        ]
      : [],
  css: '.marpit { color: black; }'
})

export interface FakeServicesBundle {
  services: AppServices
  beforeUnloadPredicate: () => boolean
}

export function createFakeServices(overrides: Partial<AppServices> = {}): FakeServicesBundle {
  const renderer = overrides.renderer ?? {
    render: vi.fn((markdown: string) => defaultRenderResult(markdown))
  }

  const htmlExporter = overrides.htmlExporter ?? {
    export: vi.fn()
  }

  const pdfExporter = overrides.pdfExporter ?? {
    export: vi.fn(async () => undefined)
  }

  const diagnosticsInspector = overrides.diagnosticsInspector ?? {
    inspect: vi.fn(async () => [])
  }

  const importer = overrides.importer ?? {
    pickAndRead: vi.fn(async () => null),
    readDropped: vi.fn(async (file: File) => file.text())
  }

  const confirm = overrides.confirm ?? {
    confirm: vi.fn(() => true)
  }

  let beforeUnloadPredicate: () => boolean = () => false

  const beforeUnload: BeforeUnloadGuard =
    overrides.beforeUnload ?? {
      attach: vi.fn((predicate: () => boolean) => {
        beforeUnloadPredicate = predicate
        return () => undefined
      })
    }

  return {
    services: {
      renderer,
      htmlExporter,
      pdfExporter,
      diagnosticsInspector,
      importer,
      confirm,
      beforeUnload
    },
    beforeUnloadPredicate
  }
}
