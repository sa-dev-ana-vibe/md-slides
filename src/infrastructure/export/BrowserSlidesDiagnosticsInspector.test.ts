import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserSlidesDiagnosticsInspector } from './BrowserSlidesDiagnosticsInspector'

describe('BrowserSlidesDiagnosticsInspector', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('extracts unique resource urls from html and css and probes them', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))

    const inspector = new BrowserSlidesDiagnosticsInspector({
      fetchFn,
      baseUrl: 'https://slides.local/editor'
    })

    const issues = await inspector.inspect({
      html: `
        <section>
          <img src="https://cdn.example.com/image.svg" />
          <img src="https://cdn.example.com/image.svg" />
          <video poster="/video/poster.png"></video>
          <img srcset="/img/a.png 1x, https://cdn.example.com/b.png 2x" />
          <div style="background-image: url('https://cdn.example.com/background.svg')"></div>
          <style>
            .hero { background-image: url('https://cdn.example.com/background.svg'); }
            .icon { background-image: url('/icons/mark.svg'); }
          </style>
        </section>
      `,
      css: `.deck { background-image: url('https://cdn.example.com/background.svg'); }`,
      slideCount: 1
    })

    expect(issues).toEqual([])

    const calledUrls = fetchFn.mock.calls.map((call) => call[0]).sort()

    expect(calledUrls).toEqual(
      [
        'https://cdn.example.com/b.png',
        'https://cdn.example.com/background.svg',
        'https://cdn.example.com/image.svg',
        'https://slides.local/icons/mark.svg',
        'https://slides.local/img/a.png',
        'https://slides.local/video/poster.png'
      ].sort()
    )
  })

  it('uses default fetch and probes only eligible resource attributes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

    try {
      const inspector = new BrowserSlidesDiagnosticsInspector({
        baseUrl: 'https://slides.local/editor'
      })

      const issues = await inspector.inspect({
        html: `
          <link rel="stylesheet preload" href="/styles/app.css" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="stylesheet" href="#local-style" />
          <input type="image" src="/images/input-image.png" />
          <input type="text" src="/images/input-text.png" />
          <picture>
            <source src="/video.mp4" srcset="/img/one.png 1x, /img/two.png 2x" />
          </picture>
          <style></style>
        `,
        css: '',
        slideCount: 1
      })

      expect(issues).toEqual([])
      const calledUrls = fetchSpy.mock.calls.map((call) => call[0]).sort()

      expect(calledUrls).toEqual(
        [
          'https://slides.local/img/one.png',
          'https://slides.local/img/two.png',
          'https://slides.local/images/input-image.png',
          'https://slides.local/styles/app.css',
          'https://slides.local/video.mp4'
        ].sort()
      )
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('does not probe plain anchor links or fragment links', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))

    const inspector = new BrowserSlidesDiagnosticsInspector({
      fetchFn,
      baseUrl: 'https://slides.local/editor'
    })

    const issues = await inspector.inspect({
      html: `
        <a href="https://marp.app/">Marp</a>
        <a href="#local-slide">Local slide</a>
        <img src="/images/hero.png" />
      `,
      css: '',
      slideCount: 1
    })

    expect(issues).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith(
      'https://slides.local/images/hero.png',
      expect.objectContaining({ method: 'GET', mode: 'no-cors' })
    )
  })

  it('returns best available probe error message', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('net::ERR_CONNECTION_CLOSED')
    })

    const inspector = new BrowserSlidesDiagnosticsInspector({
      fetchFn,
      baseUrl: 'https://slides.local/editor'
    })

    const issues = await inspector.inspect({
      html: '<img src="https://marp.app/assets/marp.svg" />',
      css: '',
      slideCount: 1
    })

    expect(issues).toEqual(['net::ERR_CONNECTION_CLOSED: https://marp.app/assets/marp.svg'])
  })

  it('returns timeout failures for long-running probes', async () => {
    vi.useFakeTimers()

    const fetchFn = vi.fn(
      async (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
    )

    const inspector = new BrowserSlidesDiagnosticsInspector({
      fetchFn,
      timeoutMs: 30,
      baseUrl: 'https://slides.local/editor'
    })

    const inspectPromise = inspector.inspect({
      html: '<img src="https://marp.app/assets/marp.svg" />',
      css: '',
      slideCount: 1
    })

    await vi.advanceTimersByTimeAsync(31)

    await expect(inspectPromise).resolves.toEqual([
      'Failed to load resource: https://marp.app/assets/marp.svg (probe timeout 30ms)'
    ])
  })

  it('normalizes urls defensively and enforces minimum worker count', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))

    const inspector = new BrowserSlidesDiagnosticsInspector({
      fetchFn,
      maxConcurrency: 0,
      baseUrl: 'https://slides.local/editor'
    })

    const issues = await inspector.inspect({
      html: `
        <img src="''" />
        <img src="http://[::1" />
        <img src=" /images/ok.svg " />
      `,
      css: `.deck { background-image: url(" "); }`,
      slideCount: 1
    })

    expect(issues).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith(
      'https://slides.local/images/ok.svg',
      expect.objectContaining({ method: 'GET', mode: 'no-cors' })
    )
  })

  it('uses raw error text when available and falls back when unavailable', async () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('/with-url.svg')) {
        throw new Error(`GET ${url} net::ERR_CONNECTION_CLOSED`)
      }

      if (url.endsWith('/empty.svg')) {
        throw new Error('   ')
      }

      if (url.endsWith('/json.svg')) {
        throw { code: 'EHOSTUNREACH' }
      }

      if (url.endsWith('/circular.svg')) {
        throw circular
      }

      return new Response(null, { status: 200 })
    })

    const inspector = new BrowserSlidesDiagnosticsInspector({
      fetchFn,
      maxConcurrency: 1,
      baseUrl: 'https://slides.local/editor'
    })

    const issues = await inspector.inspect({
      html: `
        <img src="https://marp.app/assets/with-url.svg" />
        <img src="https://marp.app/assets/empty.svg" />
        <img src="https://marp.app/assets/json.svg" />
        <img src="https://marp.app/assets/circular.svg" />
      `,
      css: '',
      slideCount: 1
    })

    expect(issues).toEqual([
      'GET https://marp.app/assets/with-url.svg net::ERR_CONNECTION_CLOSED',
      'Failed to load resource: https://marp.app/assets/empty.svg',
      '{"code":"EHOSTUNREACH"}: https://marp.app/assets/json.svg',
      'Failed to load resource: https://marp.app/assets/circular.svg'
    ])
  })

  it('skips unsupported protocols', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))

    const inspector = new BrowserSlidesDiagnosticsInspector({
      fetchFn,
      baseUrl: 'https://slides.local/editor'
    })

    const issues = await inspector.inspect({
      html: `
        <img src="data:image/svg+xml;base64,AA" />
        <img src="blob:https://slides.local/id" />
        <a href="mailto:test@example.com">Mail</a>
      `,
      css: `.deck { background-image: url('javascript:alert(1)'); }`,
      slideCount: 1
    })

    expect(issues).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
