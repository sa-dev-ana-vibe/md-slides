import { describe, expect, it } from 'vitest'
import {
  ASK_AI_SYSTEM_PROMPT_TEMPLATE,
  buildAskAiFullPrompt,
  buildChatGptPromptUrl,
  type AskAiPromptVariables
} from './buildAskAiPrompt'

const VARIABLES: AskAiPromptVariables = {
  themeName: 'gaia',
  includePresenterNotes: true,
  targetSlideCount: 'large',
  sizePreset: '16:9'
}

describe('buildAskAiPrompt', () => {
  it('substitutes variables and appends user brief', () => {
    const prompt = buildAskAiFullPrompt(VARIABLES, 'Build a launch demo deck')

    expect(prompt).toContain('- themeName = "gaia"')
    expect(prompt).toContain('- includePresenterNotes = true')
    expect(prompt).toContain('- targetSlideCount = "large"')
    expect(prompt).toContain('- sizePreset = "16:9"')
    expect(prompt).toContain('theme: "gaia"')
    expect(prompt).toContain('\n\nUSER_BRIEF:\nBuild a launch demo deck')
  })

  it('keeps size preset blank and trims user brief', () => {
    const prompt = buildAskAiFullPrompt(
      {
        ...VARIABLES,
        sizePreset: '',
        includePresenterNotes: false,
        targetSlideCount: 'small'
      },
      '  Keep it under 6 slides.  '
    )

    expect(prompt).toContain('- includePresenterNotes = false')
    expect(prompt).toContain('- targetSlideCount = "small"')
    expect(prompt).toContain('- sizePreset = ""')
    expect(prompt).toContain('USER_BRIEF:\nKeep it under 6 slides.')
  })

  it('exports the full template string', () => {
    expect(ASK_AI_SYSTEM_PROMPT_TEMPLATE.startsWith('You are a Marp Markdown presentation generator.')).toBe(true)
  })

  it('builds a chatgpt url by appending encoded prompt', () => {
    const url = buildChatGptPromptUrl('https://chatgpt.com/?prompt=', 'Line 1\nLine 2')

    expect(url).toBe('https://chatgpt.com/?prompt=Line%201%0ALine%202')
  })

  it('supports prompt placeholder in base url', () => {
    const url = buildChatGptPromptUrl('https://example.com/?q={prompt}', 'size: 16:9')

    expect(url).toBe('https://example.com/?q=size%3A%2016%3A9')
  })
})
