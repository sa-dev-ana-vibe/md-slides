import { describe, expect, it } from 'vitest'
import { buildStandaloneHtml } from './buildStandaloneHtml'

describe('buildStandaloneHtml', () => {
  it('builds html document with title, css, and content', () => {
    const documentHtml = buildStandaloneHtml(
      {
        html: '<div>slides</div>',
        css: 'body { color: red; }',
        slideCount: 1
      },
      'Deck'
    )

    expect(documentHtml).toContain('<!doctype html>')
    expect(documentHtml).toContain('<title>Deck</title>')
    expect(documentHtml).toContain('body { color: red; }')
    expect(documentHtml).toContain('<div>slides</div>')
  })

  it('escapes html-sensitive title characters', () => {
    const documentHtml = buildStandaloneHtml(
      {
        html: '<div>slides</div>',
        css: '',
        slideCount: 0
      },
      '<Deck & "Test">'
    )

    expect(documentHtml).toContain('&lt;Deck &amp; &quot;Test&quot;&gt;')
  })
})
