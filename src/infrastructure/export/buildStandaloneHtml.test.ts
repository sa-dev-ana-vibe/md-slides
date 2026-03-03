import { describe, expect, it } from 'vitest'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './diagnostics'
import { buildPresentationSlideHtml, buildStandaloneHtml } from './buildStandaloneHtml'
import { PRESENTATION_MESSAGE_SOURCE } from '../presentation/messages'

describe('buildStandaloneHtml', () => {
  it('builds html document with title, css, and joined slides', () => {
    const documentHtml = buildStandaloneHtml(
      {
        html: ['<svg data-marpit-svg="" id="slide-1"></svg>', '<svg data-marpit-svg="" id="slide-2"></svg>'],
        css: 'body { color: red; }'
      },
      'Deck'
    )

    expect(documentHtml).toContain('<!doctype html>')
    expect(documentHtml).toContain('<title>Deck</title>')
    expect(documentHtml).toContain('body { color: red; }')
    expect(documentHtml).toContain('<div class="marpit"><svg data-marpit-svg="" id="slide-1"></svg><svg data-marpit-svg="" id="slide-2"></svg></div>')
  })

  it('escapes html-sensitive title characters', () => {
    const documentHtml = buildStandaloneHtml(
      {
        html: [],
        css: ''
      },
      '<Deck & "Test">'
    )

    expect(documentHtml).toContain('&lt;Deck &amp; &quot;Test&quot;&gt;')
  })

  it('injects diagnostics script when channel id is provided', () => {
    const documentHtml = buildStandaloneHtml(
      {
        html: ['<svg data-marpit-svg="" id="slide"></svg>'],
        css: ''
      },
      'Deck',
      { diagnosticsChannelId: 'preview-1', scriptNonce: 'testnonce' }
    )

    expect(documentHtml).toContain(`script-src &#39;nonce-testnonce&#39;`)
    expect(documentHtml).toContain('<script nonce="testnonce">')
    expect(documentHtml).toContain('DIAGNOSTICS_CHANNEL_ID = "preview-1"')
    expect(documentHtml).toContain(`DIAGNOSTICS_SOURCE = "${DIAGNOSTICS_MESSAGE_SOURCE}"`)
    expect(documentHtml).toContain("window.parent.postMessage")
  })

  it('accepts caller-provided nonce with base64 characters', () => {
    const scriptNonce = 'nonce+/with/slash=='
    const documentHtml = buildStandaloneHtml(
      {
        html: ['<svg data-marpit-svg="" id="slide"></svg>'],
        css: ''
      },
      'Deck',
      { diagnosticsChannelId: 'preview-1', scriptNonce }
    )

    expect(documentHtml).toContain(`script-src &#39;nonce-${scriptNonce}&#39;`)
    expect(documentHtml).toContain(`<script nonce="${scriptNonce}">`)
  })

  it('builds presentation html for single slide and bridge script', () => {
    const documentHtml = buildPresentationSlideHtml(
      '<svg data-marpit-svg="" id="slide-1"></svg>',
      'section { color: white; }',
      'Deck',
      { channelId: 'presentation-1', scriptNonce: 'bridge123' }
    )

    expect(documentHtml).toContain(`script-src &#39;nonce-bridge123&#39;`)
    expect(documentHtml).toContain('<script nonce="bridge123">')
    expect(documentHtml).toContain('<div class="marpit"><svg data-marpit-svg="" id="slide-1"></svg></div>')
    expect(documentHtml).toContain("type: 'navigate'")
    expect(documentHtml).toContain('PRESENTATION_CHANNEL_ID = "presentation-1"')
    expect(documentHtml).toContain(`PRESENTATION_SOURCE = "${PRESENTATION_MESSAGE_SOURCE}"`)
    expect(documentHtml).toContain("emitNavigate('next')")
    expect(documentHtml).toContain("emitNavigate('previous')")
    expect(documentHtml).toContain("emitNavigate('first')")
    expect(documentHtml).toContain("emitNavigate('last')")
    expect(documentHtml).toContain("type: 'exit'")
  })
})
