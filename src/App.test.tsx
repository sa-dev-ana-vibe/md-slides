import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { MarkdownEditorAdapterProps } from './components/MarkdownEditorPane'
import { renderWithServices } from './test/renderWithServices'
import { createFakeServices } from './test/fakes'

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

describe('App', () => {
  it('renders base layout and disables exports with empty markdown', () => {
    const { services } = createFakeServices()

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    expect(screen.getByText('MD Slides')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export PPTX' })).toBeDisabled()
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

  it('runs exports and surfaces action errors', async () => {
    const htmlExport = vi.fn()
    const pdfExport = vi.fn(async () => undefined)
    const pptxExport = vi.fn(async () => {
      throw new Error('pptx failed')
    })

    const { services } = createFakeServices({
      htmlExporter: { export: htmlExport },
      pdfExporter: { export: pdfExport },
      pptxExporter: { export: pptxExport }
    })

    renderWithServices(<App editorComponent={TestEditor} renderDebounceMs={0} />, services)

    const user = userEvent.setup()
    await user.type(screen.getByTestId('app-markdown-input'), '# slide')

    await user.click(screen.getByRole('button', { name: 'Export HTML' }))
    expect(htmlExport).toHaveBeenCalledWith('# slide')

    await user.click(screen.getByRole('button', { name: 'Export PDF' }))
    await waitFor(() => {
      expect(pdfExport).toHaveBeenCalledWith('# slide')
    })

    await user.click(screen.getByRole('button', { name: 'Export PPTX' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to export PPTX: pptx failed')
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
