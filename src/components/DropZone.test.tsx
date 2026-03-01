import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DropZone, isMarkdownFile, pickFirstMarkdownFile } from './DropZone'

function createDataTransfer(files: File[]) {
  return { files }
}

describe('DropZone utilities', () => {
  it('detects markdown files by extension or mime type', () => {
    expect(isMarkdownFile(new File(['#'], 'deck.md', { type: 'text/plain' }))).toBe(true)
    expect(isMarkdownFile(new File(['#'], 'deck.markdown', { type: '' }))).toBe(true)
    expect(isMarkdownFile(new File(['#'], 'deck.txt', { type: 'text/markdown' }))).toBe(true)
    expect(isMarkdownFile(new File(['#'], 'deck.txt', { type: 'text/plain' }))).toBe(false)
  })

  it('picks first markdown file from dataTransfer', () => {
    const txtFile = new File(['x'], 'note.txt', { type: 'text/plain' })
    const mdFile = new File(['# title'], 'deck.md', { type: 'text/plain' })

    const picked = pickFirstMarkdownFile(createDataTransfer([txtFile, mdFile]))
    expect(picked).toBe(mdFile)
  })

  it('returns null when no markdown file exists', () => {
    const txtFile = new File(['x'], 'note.txt', { type: 'text/plain' })

    expect(pickFirstMarkdownFile(createDataTransfer([txtFile]))).toBeNull()
    expect(pickFirstMarkdownFile(null)).toBeNull()
  })
})

describe('DropZone', () => {
  it('invokes callback on markdown file drop', () => {
    const onMarkdownFileDrop = vi.fn()
    const file = new File(['# slide'], 'deck.md', { type: 'text/plain' })

    render(
      <DropZone onMarkdownFileDrop={onMarkdownFileDrop}>
        <div>Editor</div>
      </DropZone>
    )

    const zone = screen.getByTestId('markdown-drop-zone')

    fireEvent.dragEnter(zone, { dataTransfer: createDataTransfer([file]) })
    expect(screen.getByText('Drop .md file to replace editor content')).toHaveClass('opacity-100')

    fireEvent.drop(zone, { dataTransfer: createDataTransfer([file]) })

    expect(onMarkdownFileDrop).toHaveBeenCalledWith(file)
    expect(screen.getByText('Drop .md file to replace editor content')).toHaveClass('opacity-0')
  })

  it('ignores non-markdown drop', () => {
    const onMarkdownFileDrop = vi.fn()
    const file = new File(['plain'], 'deck.txt', { type: 'text/plain' })

    render(
      <DropZone onMarkdownFileDrop={onMarkdownFileDrop}>
        <div>Editor</div>
      </DropZone>
    )

    const zone = screen.getByTestId('markdown-drop-zone')

    fireEvent.dragEnter(zone, { dataTransfer: createDataTransfer([file]) })
    fireEvent.drop(zone, { dataTransfer: createDataTransfer([file]) })

    expect(onMarkdownFileDrop).not.toHaveBeenCalled()
  })

  it('deactivates overlay on drag leave', () => {
    const onMarkdownFileDrop = vi.fn()
    const file = new File(['# slide'], 'deck.md', { type: 'text/plain' })

    render(
      <DropZone onMarkdownFileDrop={onMarkdownFileDrop}>
        <div>Editor</div>
      </DropZone>
    )

    const zone = screen.getByTestId('markdown-drop-zone')

    fireEvent.dragEnter(zone, { dataTransfer: createDataTransfer([file]) })
    fireEvent.dragLeave(zone, { dataTransfer: createDataTransfer([file]) })

    expect(screen.getByText('Drop .md file to replace editor content')).toHaveClass('opacity-0')
  })

  it('handles drag over and nested drag depth correctly', () => {
    const onMarkdownFileDrop = vi.fn()
    const markdownFile = new File(['# slide'], 'deck.md', { type: 'text/plain' })
    const plainFile = new File(['plain'], 'deck.txt', { type: 'text/plain' })

    render(
      <DropZone onMarkdownFileDrop={onMarkdownFileDrop}>
        <div>Editor</div>
      </DropZone>
    )

    const zone = screen.getByTestId('markdown-drop-zone')
    const overlay = screen.getByText('Drop .md file to replace editor content')

    fireEvent.dragOver(zone, { dataTransfer: createDataTransfer([plainFile]) })
    expect(overlay).toHaveClass('opacity-0')

    fireEvent.dragEnter(zone, { dataTransfer: createDataTransfer([markdownFile]) })
    fireEvent.dragEnter(zone, { dataTransfer: createDataTransfer([markdownFile]) })
    fireEvent.dragOver(zone, { dataTransfer: createDataTransfer([markdownFile]) })
    expect(overlay).toHaveClass('opacity-100')

    fireEvent.dragLeave(zone, { dataTransfer: createDataTransfer([markdownFile]) })
    expect(overlay).toHaveClass('opacity-100')

    fireEvent.dragLeave(zone, { dataTransfer: createDataTransfer([plainFile]) })
    expect(overlay).toHaveClass('opacity-100')

    fireEvent.dragLeave(zone, { dataTransfer: createDataTransfer([markdownFile]) })
    expect(overlay).toHaveClass('opacity-0')
  })
})
