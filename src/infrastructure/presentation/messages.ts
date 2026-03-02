export const PRESENTATION_MESSAGE_SOURCE = 'md-slides-presentation'

export interface PresentationExitMessage {
  source: typeof PRESENTATION_MESSAGE_SOURCE
  type: 'exit'
  channelId: string
}

let presentationChannelCounter = 0

export function createPresentationChannelId(scope: string): string {
  presentationChannelCounter += 1
  return `${scope}-${presentationChannelCounter}`
}

export function asPresentationExitMessage(value: unknown): PresentationExitMessage | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>

  if (candidate.source !== PRESENTATION_MESSAGE_SOURCE) {
    return null
  }

  if (candidate.type !== 'exit') {
    return null
  }

  if (typeof candidate.channelId !== 'string' || candidate.channelId.trim().length === 0) {
    return null
  }

  return {
    source: PRESENTATION_MESSAGE_SOURCE,
    type: 'exit',
    channelId: candidate.channelId
  }
}
