import { describe, expect, it, vi } from 'vitest'
import { createAppServices } from './createAppServices'

describe('createAppServices', () => {
  it('creates default service implementations', () => {
    const services = createAppServices()

    expect(typeof services.renderer.render).toBe('function')
    expect(typeof services.htmlExporter.export).toBe('function')
    expect(typeof services.pdfExporter.export).toBe('function')
    expect(typeof services.diagnosticsInspector.inspect).toBe('function')
    expect(typeof services.importer.pickAndRead).toBe('function')
    expect(typeof services.confirm.confirm).toBe('function')
    expect(typeof services.beforeUnload.attach).toBe('function')
  })

  it('applies overrides', async () => {
    const renderer = { render: vi.fn(() => ({ html: '', css: '', slideCount: 0 })) }

    const services = createAppServices({ renderer })
    services.renderer.render('# test')

    expect(renderer.render).toHaveBeenCalledWith('# test')
  })
})
