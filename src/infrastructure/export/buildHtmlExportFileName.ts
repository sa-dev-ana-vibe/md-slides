interface BuildHtmlExportFileNameOptions {
  markdown: string
  sourceFileName?: string | null
  now?: Date
}

function extractFileStem(fileName: string): string {
  const trimmedName = fileName.trim()

  if (trimmedName.length === 0) {
    return ''
  }

  const extensionStartIndex = trimmedName.lastIndexOf('.')

  if (extensionStartIndex <= 0) {
    return trimmedName
  }

  return trimmedName.slice(0, extensionStartIndex)
}

function extractFirstHeading(markdown: string): string {
  let inFencedCodeBlock = false
  let fenceDelimiter: '```' | '~~~' | null = null

  for (const line of markdown.split(/\r?\n/)) {
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
      const nextFenceDelimiter: '```' | '~~~' = trimmedLine.startsWith('```') ? '```' : '~~~'

      if (!inFencedCodeBlock) {
        inFencedCodeBlock = true
        fenceDelimiter = nextFenceDelimiter
        continue
      }

      if (fenceDelimiter === nextFenceDelimiter) {
        inFencedCodeBlock = false
        fenceDelimiter = null
      }

      continue
    }

    if (inFencedCodeBlock) {
      continue
    }

    const headingMatch = /^#\s+(.+?)\s*#*\s*$/.exec(trimmedLine)

    if (headingMatch) {
      return headingMatch[1]
    }
  }

  return ''
}

function sanitizeBaseName(baseName: string): string {
  const withoutForbiddenCharacters = Array.from(baseName, (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    const isControlCharacter = codePoint >= 0 && codePoint < 0x20

    if (isControlCharacter) {
      return ' '
    }

    return /[<>:"/\\|?*]/.test(character) ? ' ' : character
  }).join('')
  const normalized = withoutForbiddenCharacters.normalize('NFKC')
  const sanitized = normalized.replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '')

  return sanitized
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}-${hour}${minute}${second}`
}

export function buildHtmlExportFileName({
  markdown,
  sourceFileName,
  now = new Date()
}: BuildHtmlExportFileNameOptions): string {
  const sourceStem = sourceFileName ? extractFileStem(sourceFileName) : ''
  const firstHeading = extractFirstHeading(markdown)
  const preferredBaseName = sourceStem || firstHeading || 'deck'
  const sanitizedBaseName = sanitizeBaseName(preferredBaseName)
  const finalBaseName = sanitizedBaseName.length > 0 ? sanitizedBaseName : 'deck'

  return `${finalBaseName}-${formatTimestamp(now)}.html`
}
