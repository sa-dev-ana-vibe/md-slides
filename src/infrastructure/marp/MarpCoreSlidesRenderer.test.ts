import { describe, expect, it } from 'vitest'
import { MarpCoreSlidesRenderer } from './MarpCoreSlidesRenderer'

describe('MarpCoreSlidesRenderer', () => {
  it('renders html, css and slide count', () => {
    const renderer = new MarpCoreSlidesRenderer()

    const result = renderer.render('# Title\n\n---\n\n# Second')

    expect(Array.isArray(result.html)).toBe(true)
    expect(result.html).toHaveLength(2)
    expect(result.html[0]).toContain('data-marpit-svg')
    expect(result.css.length).toBeGreaterThan(100)
  })

  it('uses emoji output without twemoji CDN references', () => {
    const renderer = new MarpCoreSlidesRenderer()

    const result = renderer.render(':dog:')

    expect(result.html.join('')).not.toContain('cdn.jsdelivr')
  })
})
