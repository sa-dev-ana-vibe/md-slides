import { describe, expect, it } from 'vitest'
import { applyFrontMatterOverrides, extractFrontMatterDeckSettings } from './frontMatterSettings'

describe('frontMatterSettings', () => {
  describe('extractFrontMatterDeckSettings', () => {
    it('extracts theme and size from top-level front matter', () => {
      const markdown = [
        '---',
        'theme: "gaia"',
        'size: 16:9',
        'paginate: true',
        '---',
        '# Hello'
      ].join('\n')

      expect(extractFrontMatterDeckSettings(markdown)).toEqual({
        themeName: 'gaia',
        sizePreset: '16:9'
      })
    })

    it('returns empty settings when markdown has no top-level front matter', () => {
      const markdown = '# Hello\n\n<!-- theme: gaia -->'

      expect(extractFrontMatterDeckSettings(markdown)).toEqual({})
    })
  })

  describe('applyFrontMatterOverrides', () => {
    it('returns original markdown when no overrides are provided', () => {
      const markdown = '# Hello'

      expect(applyFrontMatterOverrides(markdown, {})).toBe(markdown)
    })

    it('adds front matter when markdown has none', () => {
      const markdown = '# Hello'

      expect(applyFrontMatterOverrides(markdown, { themeName: 'gaia', sizePreset: '4:3' })).toBe(
        ['---', 'theme: "gaia"', 'size: "4:3"', '---', '# Hello'].join('\n')
      )
    })

    it('updates existing theme and preserves unrelated front matter fields', () => {
      const markdown = ['---', 'theme: default', 'paginate: true', '---', '# Hello'].join('\n')

      expect(applyFrontMatterOverrides(markdown, { themeName: 'uncover' })).toBe(
        ['---', 'theme: "uncover"', 'paginate: true', '---', '# Hello'].join('\n')
      )
    })

    it('removes size when override requests omit size', () => {
      const markdown = ['---', 'theme: gaia', 'size: "16:9"', 'paginate: true', '---', '# Hello'].join('\n')

      expect(applyFrontMatterOverrides(markdown, { sizePreset: '' })).toBe(
        ['---', 'theme: gaia', 'paginate: true', '---', '# Hello'].join('\n')
      )
    })

    it('removes front matter block if it becomes empty', () => {
      const markdown = ['---', 'size: "16:9"', '---', '# Hello'].join('\n')

      expect(applyFrontMatterOverrides(markdown, { sizePreset: '' })).toBe('# Hello')
    })

    it('preserves CRLF newline style in resulting markdown', () => {
      const markdown = ['---', 'theme: default', '---', '# Hello'].join('\r\n')

      expect(applyFrontMatterOverrides(markdown, { sizePreset: '16:9' })).toBe(
        ['---', 'theme: default', 'size: "16:9"', '---', '# Hello'].join('\r\n')
      )
    })
  })
})
