import type { SizePreset } from '../prompt/buildAskAiPrompt'

export interface DeckFrontMatterSettings {
  themeName?: string
  sizePreset?: string
}

interface ParsedFrontMatter {
  frontMatterContent: string
  body: string
  newline: string
}

interface FrontMatterOverrides {
  themeName?: string
  sizePreset?: SizePreset
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const KEY_VALUE_PATTERN = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/

function detectNewline(text: string): string {
  const firstLineBreakIndex = text.indexOf('\n')

  if (firstLineBreakIndex === -1) {
    return '\n'
  }

  return firstLineBreakIndex > 0 && text[firstLineBreakIndex - 1] === '\r' ? '\r\n' : '\n'
}

function parseTopFrontMatter(markdown: string): ParsedFrontMatter | null {
  const match = markdown.match(FRONT_MATTER_PATTERN)

  if (!match) {
    return null
  }

  return {
    frontMatterContent: match[1],
    body: markdown.slice(match[0].length),
    newline: detectNewline(match[0])
  }
}

function parseQuotedYamlString(value: string): string {
  const trimmedValue = value.trim()

  if (trimmedValue.length < 2) {
    return trimmedValue
  }

  const startsWithDoubleQuote = trimmedValue.startsWith('"') && trimmedValue.endsWith('"')
  const startsWithSingleQuote = trimmedValue.startsWith("'") && trimmedValue.endsWith("'")

  if (!startsWithDoubleQuote && !startsWithSingleQuote) {
    return trimmedValue
  }

  const quote = trimmedValue[0]
  const innerValue = trimmedValue.slice(1, -1)
  const escapedQuote = `\\${quote}`

  return innerValue.replaceAll(escapedQuote, quote)
}

function extractKeyValueLine(line: string): { key: string; value: string } | null {
  const match = line.match(KEY_VALUE_PATTERN)

  if (!match) {
    return null
  }

  return {
    key: match[1],
    value: match[2]
  }
}

function escapeDoubleQuotedYamlValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function extractFrontMatterDeckSettings(markdown: string): DeckFrontMatterSettings {
  const parsedFrontMatter = parseTopFrontMatter(markdown)

  if (!parsedFrontMatter) {
    return {}
  }

  const settings: DeckFrontMatterSettings = {}
  const lines = parsedFrontMatter.frontMatterContent.split(/\r?\n/)

  for (const line of lines) {
    const keyValueLine = extractKeyValueLine(line)

    if (!keyValueLine) {
      continue
    }

    const key = keyValueLine.key.toLowerCase()
    const value = parseQuotedYamlString(keyValueLine.value)

    if (key === 'theme') {
      settings.themeName = value
      continue
    }

    if (key === 'size') {
      settings.sizePreset = value
    }
  }

  return settings
}

export function applyFrontMatterOverrides(markdown: string, overrides: FrontMatterOverrides): string {
  const hasThemeOverride = overrides.themeName !== undefined
  const hasSizeOverride = overrides.sizePreset !== undefined

  if (!hasThemeOverride && !hasSizeOverride) {
    return markdown
  }

  const parsedFrontMatter = parseTopFrontMatter(markdown)
  const newline = parsedFrontMatter?.newline ?? detectNewline(markdown)
  const existingLines = parsedFrontMatter ? parsedFrontMatter.frontMatterContent.split(/\r?\n/) : []
  const nextLines = [...existingLines]

  let themeLineIndex = -1
  let sizeLineIndex = -1

  for (let index = 0; index < nextLines.length; index += 1) {
    const keyValueLine = extractKeyValueLine(nextLines[index])

    if (!keyValueLine) {
      continue
    }

    const key = keyValueLine.key.toLowerCase()

    if (key === 'theme') {
      themeLineIndex = index
      continue
    }

    if (key === 'size') {
      sizeLineIndex = index
    }
  }

  if (hasThemeOverride) {
    const themeLine = `theme: "${escapeDoubleQuotedYamlValue(overrides.themeName ?? '')}"`

    if (themeLineIndex >= 0) {
      nextLines[themeLineIndex] = themeLine
    } else {
      nextLines.push(themeLine)
      themeLineIndex = nextLines.length - 1
    }
  }

  if (hasSizeOverride) {
    if (overrides.sizePreset === '') {
      if (sizeLineIndex >= 0) {
        nextLines.splice(sizeLineIndex, 1)
      }
    } else {
      const sizeLine = `size: "${escapeDoubleQuotedYamlValue(overrides.sizePreset ?? '')}"`

      if (sizeLineIndex >= 0) {
        nextLines[sizeLineIndex] = sizeLine
      } else {
        nextLines.push(sizeLine)
      }
    }
  }

  if (nextLines.length === 0) {
    return parsedFrontMatter ? parsedFrontMatter.body : markdown
  }

  const body = parsedFrontMatter ? parsedFrontMatter.body : markdown
  const frontMatter = `---${newline}${nextLines.join(newline)}${newline}---`

  if (body.length === 0) {
    return `${frontMatter}${newline}`
  }

  return `${frontMatter}${newline}${body}`
}
