import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { MarkdownEditorAdapterProps } from './components/MarkdownEditorPane'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './infrastructure/export/diagnostics'
import { createFakeServices } from './test/fakes'
import { renderWithServices } from './test/renderWithServices'

function TestEditor({ value, onChange }: MarkdownEditorAdapterProps) {
  return (
    <textarea
      aria-label="Markdown input"
      data-testid="app-markdown-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function getPreviewDiagnosticsChannelId(): string {
  const previewFrame = screen.getByTitle('Slides preview') as HTMLIFrameElement
  const match = previewFrame.srcdoc.match(/DIAGNOSTICS_CHANNEL_ID = ([^;]+);/)

  if (!match) {
    throw new Error('Unable to find diagnostics channel id in preview frame HTML.')
  }

  return JSON.parse(match[1]) as string
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined
  let reject: (reason?: unknown) => void = () => undefined

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

describe('App', () => {
  it('renders base layout and disables exports with empty markdown', () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    expect(screen.getByText('MD Slides')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
  })

  it('switches ui language from header language selector', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    const localeSelect = screen.getByLabelText('Language')
    await user.selectOptions(localeSelect, 'ru')

    expect(screen.getByText('MD Слайды')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть .md' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Экспорт HTML' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Экспорт PDF' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Язык'), 'kk')
    expect(screen.getByText('MD Слайдтар')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '.md ашу' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'HTML экспорттау' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF экспорттау' })).toBeInTheDocument()
  })

  it('renders markdown via renderer and updates preview count', async () => {
    const render = vi.fn((markdown: string) => ({
      html: `<div><svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject><section>${markdown}</section></foreignObject></svg></div>`,
      css: '.x{}',
      slideCount: 1
    }))

    const { services } = createFakeServices({ renderer: { render } })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# Hello')

    await waitFor(() => {
      expect(render).toHaveBeenCalledWith('# Hello')
    })

    expect(screen.getByText('1 slide')).toBeInTheDocument()
  })

  it('disables pdf while diagnostics probe is pending', async () => {
    const diagnosticsDeferred = createDeferred<string[]>()
    const diagnosticsInspector = {
      inspect: vi.fn(() => diagnosticsDeferred.promise)
    }

    const { services } = createFakeServices({ diagnosticsInspector })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Checking external resources used by slides...')
    })

    const pdfButton = screen.getByRole('button', { name: 'Export PDF' })
    expect(pdfButton).toBeDisabled()
    expect(pdfButton).toHaveAttribute('title', 'Checking external resources before enabling PDF export.')
    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeEnabled()

    diagnosticsDeferred.resolve([])

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    })
  })

  it('shows active diagnostics issues from inspector and keeps pdf disabled', async () => {
    const diagnosticsInspector = {
      inspect: vi.fn(async () => ['TypeError: Failed to fetch: https://marp.app/assets/hero-background.svg'])
    }

    const { services } = createFakeServices({ diagnosticsInspector })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    await waitFor(() => {
      expect(screen.getByText('Preview issues detected. PDF export is disabled until they are resolved.')).toBeInTheDocument()
    })

    expect(screen.getByText('TypeError: Failed to fetch: https://marp.app/assets/hero-background.svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeEnabled()
  })

  it('surfaces diagnostics inspector failures in preview issues', async () => {
    const diagnosticsInspector = {
      inspect: vi.fn(async () => {
        throw new Error('probe crashed')
      })
    }

    const { services } = createFakeServices({ diagnosticsInspector })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    await waitFor(() => {
      expect(screen.getByText('probe crashed')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
  })

  it('ignores stale active diagnostics results from older render', async () => {
    const firstDiagnosticsDeferred = createDeferred<string[]>()
    const diagnosticsInspector = {
      inspect: vi
        .fn<() => Promise<string[]>>()
        .mockImplementationOnce(() => firstDiagnosticsDeferred.promise)
        .mockImplementation(async () => [])
    }

    const { services } = createFakeServices({ diagnosticsInspector })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# one')
    await user.type(screen.getByTestId('app-markdown-input'), '\n# two')

    firstDiagnosticsDeferred.resolve(['old issue'])

    await waitFor(() => {
      expect(screen.queryByText('old issue')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    })
  })

  it('opens markdown file and replaces editor content', async () => {
    const pickAndRead = vi.fn(async () => '# imported')
    const { services } = createFakeServices({
      importer: {
        pickAndRead,
        readDropped: vi.fn(async () => '# dropped')
      }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open .md' }))

    expect(pickAndRead).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('app-markdown-input')).toHaveValue('# imported')
  })

  it('keeps content unchanged when file picker is cancelled', async () => {
    const pickAndRead = vi.fn(async () => null)
    const { services } = createFakeServices({
      importer: {
        pickAndRead,
        readDropped: vi.fn(async () => '# dropped')
      }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# stays')
    await user.click(screen.getByRole('button', { name: 'Open .md' }))

    expect(screen.getByTestId('app-markdown-input')).toHaveValue('# stays')
  })

  it('asks for confirmation before replacing existing markdown', async () => {
    const pickAndRead = vi.fn(async () => '# replacement')
    const confirm = { confirm: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true) }
    const { services } = createFakeServices({
      importer: {
        pickAndRead,
        readDropped: vi.fn(async () => '# dropped')
      },
      confirm
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# current')
    await user.click(screen.getByRole('button', { name: 'Open .md' }))

    expect(confirm.confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('app-markdown-input')).toHaveValue('# current')

    await user.click(screen.getByRole('button', { name: 'Open .md' }))
    expect(screen.getByTestId('app-markdown-input')).toHaveValue('# replacement')
  })

  it('imports dropped markdown file', async () => {
    const readDropped = vi.fn(async () => '# from drop')
    const { services } = createFakeServices({
      importer: {
        pickAndRead: vi.fn(async () => null),
        readDropped
      }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const file = new File(['# drop'], 'deck.md', { type: 'text/plain' })
    const zone = screen.getByTestId('markdown-drop-zone')

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(readDropped).toHaveBeenCalledWith(file)
    })

    expect(screen.getByTestId('app-markdown-input')).toHaveValue('# from drop')
  })

  it('surfaces importer errors with unknown error fallback', async () => {
    const { services } = createFakeServices({
      importer: {
        pickAndRead: vi.fn(async () => {
          throw 'not-an-error'
        }),
        readDropped: vi.fn(async () => {
          throw 'drop-failure'
        })
      }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open .md' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to open Markdown file: Unknown error')
    })

    const zone = screen.getByTestId('markdown-drop-zone')
    const file = new File(['# drop'], 'deck.md', { type: 'text/plain' })
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to read dropped file: Unknown error')
    })
  })

  it('shows passive preview diagnostics and blocks pdf export while allowing html export', async () => {
    const htmlExport = vi.fn()
    const pdfExport = vi.fn(async () => undefined)

    const { services } = createFakeServices({
      htmlExporter: { export: htmlExport },
      pdfExporter: { export: pdfExport }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    const previewChannelId = getPreviewDiagnosticsChannelId()

    const diagnosticsMessage = 'GET https://marp.app/assets/marp.svg net::ERR_CONNECTION_CLOSED'
    const diagnosticsEvent = new MessageEvent('message', {
      data: {
        source: DIAGNOSTICS_MESSAGE_SOURCE,
        channelId: previewChannelId,
        type: 'error',
        message: diagnosticsMessage
      }
    })

    window.dispatchEvent(diagnosticsEvent)
    window.dispatchEvent(diagnosticsEvent)

    await waitFor(() => {
      expect(screen.getByText('Preview issues detected. PDF export is disabled until they are resolved.')).toBeInTheDocument()
    })

    expect(screen.getByText(diagnosticsMessage)).toBeInTheDocument()
    expect(screen.getAllByText(diagnosticsMessage)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Export HTML' }))
    expect(htmlExport).toHaveBeenCalledWith('# slide')
    expect(pdfExport).not.toHaveBeenCalled()
  })

  it('ignores invalid diagnostics message payloads', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    const previewChannelId = getPreviewDiagnosticsChannelId()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'another-source',
          channelId: previewChannelId,
          type: 'error',
          message: 'ignored'
        }
      })
    )

    await waitFor(() => {
      expect(screen.queryByText('ignored')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    })
  })

  it('ignores diagnostics from stale preview channels', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# one')

    const oldChannelId = getPreviewDiagnosticsChannelId()

    await user.type(screen.getByTestId('app-markdown-input'), '\n# two')

    const currentChannelId = getPreviewDiagnosticsChannelId()
    expect(currentChannelId).not.toBe(oldChannelId)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: DIAGNOSTICS_MESSAGE_SOURCE,
          channelId: oldChannelId,
          type: 'error',
          message: 'stale error'
        }
      })
    )

    await waitFor(() => {
      expect(screen.queryByText('stale error')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    })
  })

  it('runs exports and surfaces action errors', async () => {
    const htmlExport = vi.fn()
    const pdfExport = vi.fn(async () => {
      throw new Error('pdf failed')
    })

    const { services } = createFakeServices({
      htmlExporter: { export: htmlExport },
      pdfExporter: { export: pdfExport }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Export HTML' }))
    expect(htmlExport).toHaveBeenCalledWith('# slide')

    await user.click(screen.getByRole('button', { name: 'Export PDF' }))
    await waitFor(() => {
      expect(pdfExport).toHaveBeenCalledWith('# slide')
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to export PDF: pdf failed')
    })
  })

  it('surfaces renderer errors', async () => {
    const { services } = createFakeServices({
      renderer: {
        render: vi.fn(() => {
          throw new Error('render boom')
        })
      }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# fail')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('render boom')
    })
  })

  it('connects before-unload predicate to markdown emptiness', async () => {
    let predicate: () => boolean = () => false

    const beforeUnload = {
      attach: vi.fn((nextPredicate: () => boolean) => {
        predicate = nextPredicate
        return () => undefined
      })
    }

    const { services } = createFakeServices({ beforeUnload })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    expect(beforeUnload.attach).toHaveBeenCalledTimes(1)
    expect(predicate()).toBe(false)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# non-empty')

    expect(predicate()).toBe(true)
  })

  it('uses debounced rendering when renderDebounceMs is positive', async () => {
    vi.useFakeTimers()
    const render = vi.fn((markdown: string) => ({
      html: `<div><svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject><section>${markdown}</section></foreignObject></svg></div>`,
      css: '.x{}',
      slideCount: 1
    }))

    const { services } = createFakeServices({ renderer: { render } })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={30} />, services)

    fireEvent.change(screen.getByTestId('app-markdown-input'), { target: { value: 'A' } })
    expect(render).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(31)
    })

    expect(render).toHaveBeenCalledWith('A')
    vi.useRealTimers()
  })
})
