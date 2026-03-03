import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App, { CHAT_GPT_PROMPT_BASE_URL } from './App'
import type { MarkdownEditorAdapterProps } from './components/MarkdownEditorPane'
import { DIAGNOSTICS_MESSAGE_SOURCE } from './infrastructure/export/diagnostics'
import { PRESENTATION_MESSAGE_SOURCE } from './infrastructure/presentation/messages'
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
  const previewFrame = screen.getByTitle<HTMLIFrameElement>('Slides preview')
  const match = previewFrame.srcdoc.match(/DIAGNOSTICS_CHANNEL_ID = ([^;]+);/)

  if (!match) {
    throw new Error('Unable to find diagnostics channel id in preview frame HTML.')
  }

  return JSON.parse(match[1]) as string
}

function getPreviewFrameWindow(): Window {
  const previewFrame = screen.getByTitle<HTMLIFrameElement>('Slides preview')

  if (!previewFrame.contentWindow) {
    throw new Error('Unable to access slides preview frame window.')
  }

  return previewFrame.contentWindow
}

function getPresentationChannelId(): string {
  const presentationFrame = screen.getByTitle<HTMLIFrameElement>('Slides presentation')
  const match = presentationFrame.srcdoc.match(/PRESENTATION_CHANNEL_ID = ([^;]+);/)

  if (!match) {
    throw new Error('Unable to find presentation channel id in presentation frame HTML.')
  }

  return JSON.parse(match[1]) as string
}

function getPresentationFrameWindow(): Window {
  const presentationFrame = screen.getByTitle<HTMLIFrameElement>('Slides presentation')

  if (!presentationFrame.contentWindow) {
    throw new Error('Unable to access slides presentation frame window.')
  }

  return presentationFrame.contentWindow
}

function dispatchWindowMessage(data: unknown, source?: MessageEventSource | null): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      source: source ?? null
    })
  )
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

function parsePromptFromChatGptUrl(url: string): string {
  if (!url.startsWith(CHAT_GPT_PROMPT_BASE_URL)) {
    throw new Error(`Unexpected URL: ${url}`)
  }

  return decodeURIComponent(url.slice(CHAT_GPT_PROMPT_BASE_URL.length))
}

function getAskAiDialog() {
  return screen.getByRole('dialog', { name: 'Ask AI' })
}

describe('App', () => {
  it('renders base layout and disables exports with empty markdown', () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    expect(screen.getByText('MD Slides')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Present' })).toBeDisabled()
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
    expect(screen.getByRole('button', { name: 'Спросить ИИ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Презентация' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Экспорт HTML' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Экспорт PDF' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Язык'), 'kk')
    expect(screen.getByText('MD Слайдтар')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '.md ашу' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI сұрау' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Презентация' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'HTML экспорттау' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF экспорттау' })).toBeInTheDocument()
  })

  it('opens ask ai modal with default values', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const dialog = within(getAskAiDialog())

    expect(getAskAiDialog()).toBeInTheDocument()
    expect(dialog.getByLabelText('Presentation brief')).toHaveValue('')
    expect(dialog.getByLabelText('Theme')).toHaveValue('default')
    expect(dialog.getByLabelText('Target slide count')).toHaveValue('medium')
    expect(dialog.getByLabelText('Size preset')).toHaveValue('')
  })

  it('copies generated ask ai prompt to clipboard writer', async () => {
    const clipboardWriter = {
      writeText: vi.fn(async () => undefined)
    }
    const { services } = createFakeServices()

    renderWithServices(
      <App editorComponent={TestEditor} renderDebounceMs={0} clipboardWriter={clipboardWriter} />,
      services
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const dialog = within(getAskAiDialog())
    await user.type(dialog.getByLabelText('Presentation brief'), 'Create slides about product launch plan')
    await user.selectOptions(dialog.getByLabelText('Theme'), 'gaia')
    await user.selectOptions(dialog.getByLabelText('Target slide count'), 'large')
    await user.selectOptions(dialog.getByLabelText('Size preset'), '4:3')
    await user.click(dialog.getByRole('button', { name: 'Copy Prompt' }))

    await waitFor(() => {
      expect(clipboardWriter.writeText).toHaveBeenCalledTimes(1)
    })

    const prompt = clipboardWriter.writeText.mock.calls[0][0] as string

    expect(prompt).toContain('- themeName = "gaia"')
    expect(prompt).toContain('- targetSlideCount = "large"')
    expect(prompt).toContain('- sizePreset = "4:3"')
    expect(prompt).toContain('theme: "gaia"')
    expect(prompt).toContain('USER_BRIEF:\nCreate slides about product launch plan')
  })

  it('opens chatgpt with encoded prompt and keeps ask ai modal open', async () => {
    const openExternalUrl = vi.fn(() => ({} as Window))
    const { services } = createFakeServices()

    renderWithServices(
      <App editorComponent={TestEditor} renderDebounceMs={0} openExternalUrl={openExternalUrl} />,
      services
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const dialog = within(getAskAiDialog())
    await user.type(dialog.getByLabelText('Presentation brief'), 'Roadmap update deck')
    await user.click(dialog.getByRole('button', { name: 'Open ChatGPT' }))

    expect(openExternalUrl).toHaveBeenCalledTimes(1)

    const openedUrl = openExternalUrl.mock.calls[0][0] as string
    const prompt = parsePromptFromChatGptUrl(openedUrl)
    expect(prompt).toContain('USER_BRIEF:\nRoadmap update deck')
    expect(getAskAiDialog()).toBeInTheDocument()
  })

  it('surfaces ask ai copy errors', async () => {
    const clipboardWriter = {
      writeText: vi.fn(async () => {
        throw 'copy failed'
      })
    }
    const { services } = createFakeServices()

    renderWithServices(
      <App editorComponent={TestEditor} renderDebounceMs={0} clipboardWriter={clipboardWriter} />,
      services
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const dialog = within(getAskAiDialog())
    await user.click(dialog.getByRole('button', { name: 'Copy Prompt' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to copy prompt: Clipboard API is not available in this browser.')
    })
  })

  it('surfaces ask ai open chatgpt errors when popup is blocked', async () => {
    const openExternalUrl = vi.fn(() => null)
    const { services } = createFakeServices()

    renderWithServices(
      <App editorComponent={TestEditor} renderDebounceMs={0} openExternalUrl={openExternalUrl} />,
      services
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const dialog = within(getAskAiDialog())
    await user.click(dialog.getByRole('button', { name: 'Open ChatGPT' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to open ChatGPT: Popup was blocked by the browser.')
    })
  })

  it('shows custom theme names in ask ai modal', async () => {
    const { services } = createFakeServices()

    renderWithServices(
      <App
        editorComponent={TestEditor}
        renderDebounceMs={0}
        getBuiltInThemeNamesFn={() => ['default', 'gaia']}
        customThemeNames={['brand-blue']}
      />,
      services
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const dialog = within(getAskAiDialog())

    expect(dialog.getByRole('option', { name: 'default' })).toBeInTheDocument()
    expect(dialog.getByRole('option', { name: 'gaia' })).toBeInTheDocument()
    expect(dialog.getByRole('option', { name: 'brand-blue' })).toBeInTheDocument()
  })

  it('syncs preview theme and size into ask ai when opening the modal', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Theme'), 'gaia')
    await user.selectOptions(screen.getByLabelText('Size preset'), '4:3')
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))

    const dialog = within(getAskAiDialog())
    expect(dialog.getByLabelText('Theme')).toHaveValue('gaia')
    expect(dialog.getByLabelText('Size preset')).toHaveValue('4:3')
  })

  it('does not live-sync ask ai edits back into preview controls', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Theme'), 'gaia')
    await user.selectOptions(screen.getByLabelText('Size preset'), '4:3')
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))

    const dialog = within(getAskAiDialog())
    await user.selectOptions(dialog.getByLabelText('Theme'), 'uncover')
    await user.selectOptions(dialog.getByLabelText('Size preset'), '')
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Theme')).toHaveValue('gaia')
    expect(screen.getByLabelText('Size preset')).toHaveValue('4:3')

    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const reopenedDialog = within(getAskAiDialog())
    expect(reopenedDialog.getByLabelText('Theme')).toHaveValue('gaia')
    expect(reopenedDialog.getByLabelText('Size preset')).toHaveValue('4:3')
  })

  it('initializes preview selectors from markdown front matter', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(
      screen.getByTestId('app-markdown-input'),
      ['---', 'theme: uncover', 'size: "4:3"', 'paginate: true', '---', '# Intro'].join('\n')
    )

    expect(screen.getByLabelText('Theme')).toHaveValue('uncover')
    expect(screen.getByLabelText('Size preset')).toHaveValue('4:3')
  })

  it('applies preview theme and size overrides to renderer and export flows', async () => {
    const render = vi.fn((markdown: string) => ({
      html: [`<svg data-marpit-svg=""><foreignObject><section>${markdown}</section></foreignObject></svg>`],
      css: '.x{}'
    }))
    const htmlExport = vi.fn()
    const pdfExport = vi.fn(async () => undefined)
    const { services } = createFakeServices({
      renderer: { render },
      htmlExporter: { export: htmlExport },
      pdfExporter: { export: pdfExport }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')
    await user.selectOptions(screen.getByLabelText('Theme'), 'gaia')
    await user.selectOptions(screen.getByLabelText('Size preset'), '4:3')

    const expectedMarkdown = ['---', 'theme: "gaia"', 'size: "4:3"', '---', '# slide'].join('\n')

    await waitFor(() => {
      expect(render).toHaveBeenLastCalledWith(expectedMarkdown)
    })

    await user.click(screen.getByRole('button', { name: 'Export HTML' }))
    expect(htmlExport).toHaveBeenCalledWith(expectedMarkdown, expect.stringMatching(/^slide-\d{8}-\d{6}\.html$/))

    await user.click(screen.getByRole('button', { name: 'Export PDF' }))
    await waitFor(() => {
      expect(pdfExport).toHaveBeenCalledWith(expectedMarkdown)
    })
  })

  it('renders markdown via renderer and updates preview count', async () => {
    const render = vi.fn((markdown: string) => ({
      html: [`<svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject><section>${markdown}</section></foreignObject></svg>`],
      css: '.x{}'
    }))

    const { services } = createFakeServices({ renderer: { render } })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# Hello')

    await waitFor(() => {
      expect(render).toHaveBeenCalledWith('# Hello')
    })

    expect(screen.getByText('1 slide')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Present' })).toBeEnabled()
  })

  it('opens presentation mode and exits on matching message', async () => {
    const render = vi.fn(() => ({
      html: [
        '<svg data-marpit-svg="" id="slide-1"><foreignObject><section><h1>One</h1></section></foreignObject></svg>',
        '<svg data-marpit-svg="" id="slide-2"><foreignObject><section><h1>Two</h1></section></foreignObject></svg>'
      ],
      css: '.x{}'
    }))
    const { services } = createFakeServices({ renderer: { render } })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Present' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Present' }))

    expect(screen.getByRole('dialog', { name: 'Presentation mode' })).toBeInTheDocument()
    expect(screen.getByTitle('Slides presentation')).toBeInTheDocument()
    expect(screen.getByTitle<HTMLIFrameElement>('Slides presentation').srcdoc).toContain('id="slide-1"')

    const presentationChannelId = getPresentationChannelId()
    const presentationFrameWindow = getPresentationFrameWindow()

    dispatchWindowMessage(
      {
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'navigate',
        action: 'next',
        channelId: presentationChannelId
      },
      presentationFrameWindow
    )

    await waitFor(() => {
      expect(screen.getByTitle<HTMLIFrameElement>('Slides presentation').srcdoc).toContain('id="slide-2"')
    })

    dispatchWindowMessage(
      {
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'exit',
        channelId: presentationChannelId
      },
      getPresentationFrameWindow()
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Presentation mode' })).not.toBeInTheDocument()
    })
  })

  it('ignores unrelated presentation exit messages', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Present' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Present' }))

    const presentationChannelId = getPresentationChannelId()
    const presentationFrameWindow = getPresentationFrameWindow()

    dispatchWindowMessage(
      {
        source: PRESENTATION_MESSAGE_SOURCE,
        type: 'exit',
        channelId: `${presentationChannelId}-other`
      },
      presentationFrameWindow
    )
    dispatchWindowMessage(
      {
        source: 'other-source',
        type: 'exit',
        channelId: presentationChannelId
      },
      presentationFrameWindow
    )

    expect(screen.getByRole('dialog', { name: 'Presentation mode' })).toBeInTheDocument()
  })

  it('closes presentation mode when deck becomes empty', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Present' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Present' }))
    expect(screen.getByRole('dialog', { name: 'Presentation mode' })).toBeInTheDocument()

    await user.clear(screen.getByTestId('app-markdown-input'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Presentation mode' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Present' })).toBeDisabled()
    })
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
    const pickAndRead = vi.fn(async () => ({ markdown: '# imported', fileName: 'imported.md' }))
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
    const pickAndRead = vi.fn(async () => ({ markdown: '# replacement', fileName: 'replacement.md' }))
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

  it('uses latest markdown state for confirmation after async import resolves', async () => {
    const pickAndReadDeferred = createDeferred<{ markdown: string; fileName: string } | null>()
    const confirm = { confirm: vi.fn(() => false) }
    const { services } = createFakeServices({
      importer: {
        pickAndRead: vi.fn(() => pickAndReadDeferred.promise),
        readDropped: vi.fn(async () => '# dropped')
      },
      confirm
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open .md' }))
    await user.type(screen.getByTestId('app-markdown-input'), '# now filled while picker pending')

    pickAndReadDeferred.resolve({ markdown: '# replacement', fileName: 'replacement.md' })

    await waitFor(() => {
      expect(confirm.confirm).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId('app-markdown-input')).toHaveValue('# now filled while picker pending')
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

  it('uses imported source file name for html export after markdown edits', async () => {
    const htmlExport = vi.fn()
    const { services } = createFakeServices({
      htmlExporter: { export: htmlExport },
      importer: {
        pickAndRead: vi.fn(async () => ({ markdown: '# Imported heading', fileName: 'roadmap-v2.md' })),
        readDropped: vi.fn(async () => '# dropped')
      }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open .md' }))
    await user.type(screen.getByTestId('app-markdown-input'), '\n# Updated heading')

    await user.click(screen.getByRole('button', { name: 'Export HTML' }))

    expect(htmlExport).toHaveBeenCalledWith(
      '# Imported heading\n# Updated heading',
      expect.stringMatching(/^roadmap-v2-\d{8}-\d{6}\.html$/)
    )
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
    const previewFrameWindow = getPreviewFrameWindow()

    const diagnosticsMessage = 'GET https://marp.app/assets/marp.svg net::ERR_CONNECTION_CLOSED'
    const diagnosticsEvent = new MessageEvent('message', {
      data: {
        source: DIAGNOSTICS_MESSAGE_SOURCE,
        channelId: previewChannelId,
        type: 'error',
        message: diagnosticsMessage
      },
      source: previewFrameWindow
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
    expect(htmlExport).toHaveBeenCalledWith('# slide', expect.stringMatching(/^slide-\d{8}-\d{6}\.html$/))
    expect(pdfExport).not.toHaveBeenCalled()
  })

  it('ignores diagnostics messages from unexpected message source', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    const previewChannelId = getPreviewDiagnosticsChannelId()

    dispatchWindowMessage(
      {
        source: DIAGNOSTICS_MESSAGE_SOURCE,
        channelId: previewChannelId,
        type: 'error',
        message: 'forged-source'
      },
      window
    )

    await waitFor(() => {
      expect(screen.queryByText('forged-source')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    })
  })

  it('ignores invalid diagnostics message payloads', async () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    const previewChannelId = getPreviewDiagnosticsChannelId()
    const previewFrameWindow = getPreviewFrameWindow()

    dispatchWindowMessage(
      {
        source: 'another-source',
        channelId: previewChannelId,
        type: 'error',
        message: 'ignored'
      },
      previewFrameWindow
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
    const previewFrameWindow = getPreviewFrameWindow()
    expect(currentChannelId).not.toBe(oldChannelId)

    dispatchWindowMessage(
      {
        source: DIAGNOSTICS_MESSAGE_SOURCE,
        channelId: oldChannelId,
        type: 'error',
        message: 'stale error'
      },
      previewFrameWindow
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
    expect(htmlExport).toHaveBeenCalledWith('# slide', expect.stringMatching(/^slide-\d{8}-\d{6}\.html$/))

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
      html: [`<svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject><section>${markdown}</section></foreignObject></svg>`],
      css: '.x{}'
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
