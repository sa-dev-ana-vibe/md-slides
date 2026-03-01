import { describe, expect, it } from 'vitest'
import { asDiagnosticsMessage, createDiagnosticsChannelId, DIAGNOSTICS_MESSAGE_SOURCE } from './diagnostics'

describe('diagnostics', () => {
  it('creates unique diagnostics channel ids', () => {
    const a = createDiagnosticsChannelId('preview')
    const b = createDiagnosticsChannelId('preview')

    expect(a).not.toBe(b)
    expect(a.startsWith('preview-')).toBe(true)
    expect(b.startsWith('preview-')).toBe(true)
  })

  it('parses valid diagnostics messages', () => {
    const parsed = asDiagnosticsMessage({
      source: DIAGNOSTICS_MESSAGE_SOURCE,
      channelId: 'preview-1',
      type: 'error',
      message: 'Failed to load IMG: https://example.com/image.svg'
    })

    expect(parsed).toEqual({
      source: DIAGNOSTICS_MESSAGE_SOURCE,
      channelId: 'preview-1',
      type: 'error',
      message: 'Failed to load IMG: https://example.com/image.svg'
    })
  })

  it('returns null for non-diagnostics messages', () => {
    expect(asDiagnosticsMessage(null)).toBeNull()
    expect(asDiagnosticsMessage({ source: 'other', type: 'error', channelId: 'x', message: 'm' })).toBeNull()
    expect(asDiagnosticsMessage({ source: DIAGNOSTICS_MESSAGE_SOURCE, type: 'warn', channelId: 'x', message: 'm' })).toBeNull()
    expect(asDiagnosticsMessage({ source: DIAGNOSTICS_MESSAGE_SOURCE, type: 'error', channelId: '', message: 'm' })).toBeNull()
    expect(asDiagnosticsMessage({ source: DIAGNOSTICS_MESSAGE_SOURCE, type: 'error', channelId: 'x', message: '' })).toBeNull()
  })
})
