import type { RenderResult } from '../../domain/types'
import type { SlidesDiagnosticsInspector, SlidesDiagnosticsInspectOptions } from '../../domain/services'

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
  cacheTtlMs?: number
  maxCacheEntries?: number
}

const DEFAULT_TIMEOUT_MS = 3_000
const DEFAULT_MAX_CONCURRENCY = 6
const DEFAULT_CACHE_TTL_MS = 30_000
const DEFAULT_MAX_CACHE_ENTRIES = 512
const LINK_RESOURCE_REL = new Set(['stylesheet', 'preload', 'modulepreload'])
const SRC_RESOURCE_TAGS = new Set(['audio', 'embed', 'iframe', 'img', 'input', 'script', 'source', 'track', 'video'])

interface ProbeCacheEntry {
  issue: string | null
  expiresAt: number
}

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

function createAbortError(): Error {
  try {
    return new DOMException('The operation was aborted.', 'AbortError')
  } catch {
    const error = new Error('The operation was aborted.')
    error.name = 'AbortError'
    return error
  }
}

export class BrowserSlidesDiagnosticsInspector implements SlidesDiagnosticsInspector {
  private readonly fetchFn: (input: string, init?: RequestInit) => Promise<Response>
  private readonly createAbortController: () => AbortControllerLike
  private readonly timeoutMs: number
  private readonly maxConcurrency: number
  private readonly baseUrl: string
  private readonly cacheTtlMs: number
  private readonly maxCacheEntries: number
  private readonly probeCache = new Map<string, ProbeCacheEntry>()

  constructor({
    fetchFn = (input, init) => fetch(input, init),
    createAbortController = () => new AbortController(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxConcurrency = DEFAULT_MAX_CONCURRENCY,
    baseUrl = typeof window === 'undefined' ? 'http://localhost/' : window.location.href,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    maxCacheEntries = DEFAULT_MAX_CACHE_ENTRIES
  }: BrowserSlidesDiagnosticsInspectorDeps = {}) {
    this.fetchFn = fetchFn
    this.createAbortController = createAbortController
    this.timeoutMs = timeoutMs
    this.maxConcurrency = Math.max(1, maxConcurrency)
    this.baseUrl = baseUrl
    this.cacheTtlMs = Math.max(0, cacheTtlMs)
    this.maxCacheEntries = Math.max(1, maxCacheEntries)
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

  private pruneProbeCache(now: number): void {
    for (const [url, cachedEntry] of this.probeCache) {
      if (cachedEntry.expiresAt <= now) {
        this.probeCache.delete(url)
      }
    }

    while (this.probeCache.size > this.maxCacheEntries) {
      const oldestCacheEntry = this.probeCache.keys().next()

      if (oldestCacheEntry.done) {
        break
      }

      this.probeCache.delete(oldestCacheEntry.value)
    }
  }

  private getCachedProbeResult(url: string, now: number): string | null | undefined {
    const cachedEntry = this.probeCache.get(url)

    if (!cachedEntry) {
      return undefined
    }

    if (cachedEntry.expiresAt <= now) {
      this.probeCache.delete(url)
      return undefined
    }

    return cachedEntry.issue
  }

  private setCachedProbeResult(url: string, issue: string | null, now: number): void {
    if (this.cacheTtlMs <= 0) {
      return
    }

    this.probeCache.set(url, {
      issue,
      expiresAt: now + this.cacheTtlMs
    })
    this.pruneProbeCache(now)
  }

  private async probeUrl(url: string, signal?: AbortSignal): Promise<string | null> {
    if (signal?.aborted) {
      throw createAbortError()
    }

    const abortController = this.createAbortController()
    let timedOut = false
    const onSignalAbort = () => {
      abortController.abort()
    }

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      abortController.abort()
    }, this.timeoutMs)

    signal?.addEventListener('abort', onSignalAbort, { once: true })

    try {
      await this.fetchFn(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        signal: abortController.signal
      })

      if (signal?.aborted) {
        throw createAbortError()
      }

      return null
    } catch (error) {
      if (signal !== undefined && signal.aborted && error instanceof Error && error.name === 'AbortError') {
        throw createAbortError()
      }

      return this.buildProbeFailureMessage(url, error, timedOut)
    } finally {
      window.clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onSignalAbort)
    }
  }

  async inspect(renderResult: RenderResult, options: SlidesDiagnosticsInspectOptions = {}): Promise<string[]> {
    const { signal } = options

    if (signal?.aborted) {
      throw createAbortError()
    }

    const urls = this.collectUrls(renderResult)

    if (urls.length === 0) {
      return []
    }

    const issues: string[] = []
    const urlsToProbe: string[] = []
    const now = Date.now()

    this.pruneProbeCache(now)

    for (const url of urls) {
      const cachedIssue = this.getCachedProbeResult(url, now)

      if (cachedIssue === undefined) {
        urlsToProbe.push(url)
        continue
      }

      if (cachedIssue) {
        issues.push(cachedIssue)
      }
    }

    if (urlsToProbe.length === 0) {
      return Array.from(new Set(issues))
    }

    let nextIndex = 0

    const workers = Array.from({ length: Math.min(this.maxConcurrency, urlsToProbe.length) }, async () => {
      while (nextIndex < urlsToProbe.length) {
        if (signal?.aborted) {
          throw createAbortError()
        }

        const currentIndex = nextIndex
        nextIndex += 1

        const url = urlsToProbe[currentIndex]
        const issue = await this.probeUrl(url, signal)
        this.setCachedProbeResult(url, issue, Date.now())

        if (issue) {
          issues.push(issue)
        }
      }
    })

    await Promise.all(workers)

    return Array.from(new Set(issues))
  }
}
