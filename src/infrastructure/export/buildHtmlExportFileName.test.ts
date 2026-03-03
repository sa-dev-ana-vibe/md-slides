import { describe, expect, it } from 'vitest'
import { buildHtmlExportFileName } from './buildHtmlExportFileName'

describe('buildHtmlExportFileName', () => {
  const fixedDate = new Date(2026, 2, 4, 7, 8, 9)

  it('uses source file name stem when available', () => {
    const fileName = buildHtmlExportFileName({
      markdown: '# Heading',
      sourceFileName: 'Roadmap Q2.md',
      now: fixedDate
    })

    expect(fileName).toBe('Roadmap-Q2-20260304-070809.html')
  })

  it('falls back to first H1 heading when source file name is missing', () => {
    const fileName = buildHtmlExportFileName({
      markdown: '# Sprint Plan',
      now: fixedDate
    })

    expect(fileName).toBe('Sprint-Plan-20260304-070809.html')
  })

  it('falls back to deck when source and H1 are both unavailable', () => {
    const fileName = buildHtmlExportFileName({
      markdown: 'plain paragraph',
      sourceFileName: '',
      now: fixedDate
    })

    expect(fileName).toBe('deck-20260304-070809.html')
  })

  it('preserves unicode while removing unsafe characters', () => {
    const fileName = buildHtmlExportFileName({
      markdown: '# ignored',
      sourceFileName: 'презентация: квартал?.md',
      now: fixedDate
    })

    expect(fileName).toBe('презентация-квартал-20260304-070809.html')
  })

  it('ignores heading-looking lines inside fenced code blocks', () => {
    const fileName = buildHtmlExportFileName({
      markdown: ['```md', '# Not a heading', '```', '# Actual title'].join('\n'),
      now: fixedDate
    })

    expect(fileName).toBe('Actual-title-20260304-070809.html')
  })
})
