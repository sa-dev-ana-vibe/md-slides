export const PRESENTATION_MESSAGE_SOURCE = 'md-slides-presentation'

export type PresentationNavigateAction = 'previous' | 'next' | 'first' | 'last'

interface PresentationMessageBase {
  source: typeof PRESENTATION_MESSAGE_SOURCE
  channelId: string
}

export interface PresentationNavigateMessage extends PresentationMessageBase {
  type: 'navigate'
  action: PresentationNavigateAction
}

export interface PresentationExitMessage extends PresentationMessageBase {
  type: 'exit'
}

export type PresentationMessage = PresentationNavigateMessage | PresentationExitMessage

let presentationChannelCounter = 0

export function createPresentationChannelId(scope: string): string {
  presentationChannelCounter += 1
  return `${scope}-${presentationChannelCounter}`
}

export function asPresentationMessage(value: unknown): PresentationMessage | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>

  if (candidate.source !== PRESENTATION_MESSAGE_SOURCE) {
    return null
  }

  if (typeof candidate.channelId !== 'string' || candidate.channelId.trim().length === 0) {
    return null
  }

  if (candidate.type === 'exit') {
    return {
      source: PRESENTATION_MESSAGE_SOURCE,
      channelId: candidate.channelId,
      type: 'exit'
    }
  }

  if (candidate.type !== 'navigate') {
    return null
  }

  if (
    candidate.action !== 'previous' &&
    candidate.action !== 'next' &&
    candidate.action !== 'first' &&
    candidate.action !== 'last'
  ) {
    return null
  }

  return {
    source: PRESENTATION_MESSAGE_SOURCE,
    channelId: candidate.channelId,
    type: 'navigate',
    action: candidate.action
  }
}
