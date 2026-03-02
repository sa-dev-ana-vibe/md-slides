import { describe, expect, it } from 'vitest'
import { asPresentationExitMessage, createPresentationChannelId, PRESENTATION_MESSAGE_SOURCE } from './messages'

describe('presentation messages', () => {
  it('creates unique presentation channel ids', () => {
    const first = createPresentationChannelId('presentation')
    const second = createPresentationChannelId('presentation')

    expect(first).toMatch(/^presentation-\d+$/)
    expect(second).toMatch(/^presentation-\d+$/)
    expect(second).not.toBe(first)
  })

  it('parses valid presentation exit message', () => {
    const message = asPresentationExitMessage({
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

  it('rejects invalid presentation messages', () => {
    expect(asPresentationExitMessage(null)).toBeNull()
    expect(
      asPresentationExitMessage({
        source: 'other',
        type: 'exit',
        channelId: 'presentation-1'
      })
    ).toBeNull()
    expect(
      asPresentationExitMessage({
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'unknown',
        channelId: 'presentation-1'
      })
    ).toBeNull()
    expect(
      asPresentationExitMessage({
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'exit',
        channelId: ''
      })
    ).toBeNull()
  })
})
