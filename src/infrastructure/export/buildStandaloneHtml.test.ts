import { describe, expect, it } from 'vitest'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './diagnostics'
import { buildStandaloneHtml } from './buildStandaloneHtml'
import { PRESENTATION_MESSAGE_SOURCE } from '../presentation/messages'

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

  it('injects diagnostics script when channel id is provided', () => {
    const documentHtml = buildStandaloneHtml(
      {
        html: '<div>slides</div>',
        css: '',
        slideCount: 0
      },
      'Deck',
      { diagnosticsChannelId: 'preview-1' }
    )

    expect(documentHtml).toContain('DIAGNOSTICS_CHANNEL_ID = "preview-1"')
    expect(documentHtml).toContain(`DIAGNOSTICS_SOURCE = "${DIAGNOSTICS_MESSAGE_SOURCE}"`)
    expect(documentHtml).toContain("window.parent.postMessage")
  })

  it('injects presentation styles and script when presentation channel is provided', () => {
    const documentHtml = buildStandaloneHtml(
      {
        html: '<div>slides</div>',
        css: '',
        slideCount: 0
      },
      'Deck',
      { presentation: { channelId: 'presentation-1' } }
    )

    expect(documentHtml).toContain('data-presentation-visible')
    expect(documentHtml).toContain('querySelectorAll(\'svg[data-marpit-svg]\')')
    expect(documentHtml).toContain('PRESENTATION_CHANNEL_ID = "presentation-1"')
    expect(documentHtml).toContain(`PRESENTATION_SOURCE = "${PRESENTATION_MESSAGE_SOURCE}"`)
    expect(documentHtml).toContain("type: 'exit'")
  })
})
