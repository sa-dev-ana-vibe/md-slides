import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownEditorPane, type MarkdownEditorAdapterProps } from './MarkdownEditorPane'

function TestEditor({ value, onChange }: MarkdownEditorAdapterProps) {
  return (
    <textarea
      aria-label="Markdown input"
      data-testid="test-markdown-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

describe('MarkdownEditorPane', () => {
  it('renders using injected editor component', () => {
    const onChange = vi.fn()

    render(<MarkdownEditorPane value="# Hello" onChange={onChange} EditorComponent={TestEditor} />)

    const input = screen.getByTestId('test-markdown-input')
    expect(input).toHaveValue('# Hello')

    fireEvent.change(input, { target: { value: '# Updated' } })
    expect(onChange).toHaveBeenCalledWith('# Updated')
  })

  it('renders default codemirror editor shell', () => {
    render(<MarkdownEditorPane value="" onChange={vi.fn()} />)

    expect(screen.getByTestId('markdown-editor-pane')).toBeInTheDocument()
    expect(screen.getByText('Markdown')).toBeInTheDocument()
  })
})
