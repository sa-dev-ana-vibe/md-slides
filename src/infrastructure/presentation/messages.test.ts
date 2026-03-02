import { describe, expect, it } from 'vitest'
import { asPresentationMessage, createPresentationChannelId, PRESENTATION_MESSAGE_SOURCE } from './messages'

describe('presentation messages', () => {
  it('creates unique presentation channel ids', () => {
    const first = createPresentationChannelId('presentation')
    const second = createPresentationChannelId('presentation')

    expect(first).toMatch(/^presentation-\d+$/)
    expect(second).toMatch(/^presentation-\d+$/)
    expect(second).not.toBe(first)
  })

  it('parses valid presentation exit message', () => {
    const message = asPresentationMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'exit',
      channelId: 'presentation-1'
    })

    expect(message).toEqual({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'exit',
      channelId: 'presentation-1'
    })
  })

  it('parses valid presentation navigate message', () => {
    const message = asPresentationMessage({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'next',
      channelId: 'presentation-1'
    })

    expect(message).toEqual({
      source: PRESENTATION_MESSAGE_SOURCE,
      type: 'navigate',
      action: 'next',
      channelId: 'presentation-1'
    })
  })

  it('rejects invalid presentation messages', () => {
    expect(asPresentationMessage(null)).toBeNull()
    expect(
      asPresentationMessage({
        source: 'other',
        type: 'exit',
        channelId: 'presentation-1'
      })
    ).toBeNull()
    expect(
      asPresentationMessage({
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'navigate',
        action: 'invalid',
        channelId: 'presentation-1'
      })
    ).toBeNull()
    expect(
      asPresentationMessage({
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'exit',
        channelId: ''
      })
    ).toBeNull()
  })
})
