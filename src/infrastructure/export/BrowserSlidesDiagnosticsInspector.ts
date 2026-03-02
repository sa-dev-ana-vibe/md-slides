import type { RenderResult } from '../../domain/types'
import type { SlidesDiagnosticsInspector } from '../../domain/services'

interface AbortControllerLike {
  readonly signal: AbortSignal
  abort: () => void
}

interface BrowserSlidesDiagnosticsInspectorDeps {
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>
  createAbortController?: () => AbortControllerLike
  timeoutMs?: number
  maxConcurrency?: number
  baseUrl?: string
}

const DEFAULT_TIMEOUT_MS = 3_000
const DEFAULT_MAX_CONCURRENCY = 6
const LINK_RESOURCE_REL = new Set(['stylesheet', 'preload', 'modulepreload'])
const SRC_RESOURCE_TAGS = new Set(['audio', 'embed', 'iframe', 'img', 'input', 'script', 'source', 'track', 'video'])

function toPlainErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const trimmedMessage = error.message.trim()

    if (trimmedMessage.length > 0) {
      return trimmedMessage
    }
  }

  if (typeof error === 'string') {
    const trimmedMessage = error.trim()

    if (trimmedMessage.length > 0) {
      return trimmedMessage
    }
  }

  if (error !== null && error !== undefined) {
    try {
      const serialized = JSON.stringify(error)

      if (serialized && serialized !== '{}') {
        return serialized
      }
    } catch {
      // ignore serialization errors and fall through to generic fallback
    }
  }

  return ''
}

export class BrowserSlidesDiagnosticsInspector implements SlidesDiagnosticsInspector {
  private readonly fetchFn: (input: string, init?: RequestInit) => Promise<Response>
  private readonly createAbortController: () => AbortControllerLike
  private readonly timeoutMs: number
  private readonly maxConcurrency: number
  private readonly baseUrl: string

  constructor({
    fetchFn = (input, init) => fetch(input, init),
    createAbortController = () => new AbortController(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxConcurrency = DEFAULT_MAX_CONCURRENCY,
    baseUrl = typeof window === 'undefined' ? 'http://localhost/' : window.location.href
  }: BrowserSlidesDiagnosticsInspectorDeps = {}) {
    this.fetchFn = fetchFn
    this.createAbortController = createAbortController
    this.timeoutMs = timeoutMs
    this.maxConcurrency = Math.max(1, maxConcurrency)
    this.baseUrl = baseUrl
  }

  private normalizeUrl(rawValue: string): string | null {
    const trimmedValue = rawValue.trim()

    if (trimmedValue.length === 0) {
      return null
    }

    const withoutQuotes =
      (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
        ? trimmedValue.slice(1, -1).trim()
        : trimmedValue

    if (withoutQuotes.length === 0) {
      return null
    }

    if (withoutQuotes.startsWith('#')) {
      return null
    }

    try {
      const url = new URL(withoutQuotes, this.baseUrl)

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null
      }

      return url.href
    } catch {
      return null
    }
  }

  private extractUrlsFromCss(cssText: string): string[] {
    const matches: string[] = []
    const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi

    let match: RegExpExecArray | null = urlPattern.exec(cssText)

    while (match) {
      matches.push(match[2])
      match = urlPattern.exec(cssText)
    }

    return matches
  }

  private extractUrlsFromSrcSet(srcSet: string): string[] {
    return srcSet
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0])
      .filter((value) => value.length > 0)
  }

  private collectUrls(renderResult: RenderResult): string[] {
    const normalizedUrls = new Set<string>()

    const pushUrl = (rawValue: string | null) => {
      if (!rawValue) {
        return
      }

      const normalizedUrl = this.normalizeUrl(rawValue)

      if (normalizedUrl) {
        normalizedUrls.add(normalizedUrl)
      }
    }

    for (const cssUrl of this.extractUrlsFromCss(renderResult.css)) {
      pushUrl(cssUrl)
    }

    const parsedDocument = new DOMParser().parseFromString(renderResult.html.join(''), 'text/html')
    const allElements = parsedDocument.querySelectorAll('*')

    for (const element of allElements) {
      const tagName = element.tagName.toLowerCase()

      if (SRC_RESOURCE_TAGS.has(tagName)) {
        if (tagName !== 'input' || element.getAttribute('type')?.toLowerCase() === 'image') {
          pushUrl(element.getAttribute('src'))
        }
      }

      if (tagName === 'video') {
        pushUrl(element.getAttribute('poster'))
      }

      if (tagName === 'img' || tagName === 'source') {
        const srcSet = element.getAttribute('srcset')

        if (srcSet) {
          for (const srcSetUrl of this.extractUrlsFromSrcSet(srcSet)) {
            pushUrl(srcSetUrl)
          }
        }
      }

      if (tagName === 'link') {
        const relValues = (element.getAttribute('rel') ?? '')
          .split(/\s+/)
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0)

        if (relValues.some((rel) => LINK_RESOURCE_REL.has(rel))) {
          pushUrl(element.getAttribute('href'))
        }
      }

      const inlineStyle = element.getAttribute('style')

      if (inlineStyle) {
        for (const cssUrl of this.extractUrlsFromCss(inlineStyle)) {
          pushUrl(cssUrl)
        }
      }
    }

    for (const styleElement of parsedDocument.querySelectorAll('style')) {
      const styleText = styleElement.textContent

      if (!styleText) {
        continue
      }

      for (const cssUrl of this.extractUrlsFromCss(styleText)) {
        pushUrl(cssUrl)
      }
    }

    return Array.from(normalizedUrls)
  }

  private buildProbeFailureMessage(url: string, error: unknown, timedOut: boolean): string {
    if (timedOut) {
      return `Failed to load resource: ${url} (probe timeout ${this.timeoutMs}ms)`
    }

    const errorMessage = toPlainErrorMessage(error)

    if (errorMessage.length === 0) {
      return `Failed to load resource: ${url}`
    }

    if (errorMessage.includes(url)) {
      return errorMessage
    }

    return `${errorMessage}: ${url}`
  }

  private async probeUrl(url: string): Promise<string | null> {
    const abortController = this.createAbortController()
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      abortController.abort()
    }, this.timeoutMs)

    try {
      await this.fetchFn(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        signal: abortController.signal
      })

      return null
    } catch (error) {
      return this.buildProbeFailureMessage(url, error, timedOut)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  async inspect(renderResult: RenderResult): Promise<string[]> {
    const urls = this.collectUrls(renderResult)

    if (urls.length === 0) {
      return []
    }

    const issues: string[] = []
    let nextIndex = 0

    const workers = Array.from({ length: Math.min(this.maxConcurrency, urls.length) }, async () => {
      while (nextIndex < urls.length) {
        const currentIndex = nextIndex
        nextIndex += 1

        const issue = await this.probeUrl(urls[currentIndex])

        if (issue) {
          issues.push(issue)
        }
      }
    })

    await Promise.all(workers)

    return Array.from(new Set(issues))
  }
}
