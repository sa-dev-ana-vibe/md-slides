export const DIAGNOSTICS_MESSAGE_SOURCE = 'md-slides-diagnostics'

export interface DiagnosticsMessage {
  source: typeof DIAGNOSTICS_MESSAGE_SOURCE
  channelId: string
  type: 'error'
  message: string
}

let diagnosticsChannelCounter = 0

export function createDiagnosticsChannelId(scope: string): string {
  diagnosticsChannelCounter += 1
  return `${scope}-${diagnosticsChannelCounter}`
}

export function asDiagnosticsMessage(value: unknown): DiagnosticsMessage | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>

  if (candidate.source !== DIAGNOSTICS_MESSAGE_SOURCE) {
    return null
  }

  if (candidate.type !== 'error') {
    return null
  }

  if (typeof candidate.channelId !== 'string' || candidate.channelId.trim().length === 0) {
    return null
  }

  if (typeof candidate.message !== 'string' || candidate.message.trim().length === 0) {
    return null
  }

  return {
    source: DIAGNOSTICS_MESSAGE_SOURCE,
    type: 'error',
    channelId: candidate.channelId,
    message: candidate.message
  }
}
