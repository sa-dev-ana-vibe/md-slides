import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PreviewPane } from './PreviewPane'

describe('PreviewPane', () => {
  function renderPreviewPane(overrides: Partial<ComponentProps<typeof PreviewPane>> = {}): void {
    render(
      <PreviewPane
        documentHtml="<html></html>"
        slideCount={0}
        themeNames={['default', 'gaia']}
        themeName="default"
        sizePreset=""
        diagnosticErrors={[]}
        diagnosticsPending={false}
        onThemeNameChange={() => undefined}
        onSizePresetChange={() => undefined}
        errorMessage={null}
        {...overrides}
      />
    )
  }

  it('renders placeholder for zero slides', () => {
    renderPreviewPane()

    expect(screen.getByText('0 slides')).toBeInTheDocument()
    expect(screen.getByText('Start typing markdown to generate slides.')).toBeInTheDocument()
    expect(screen.getByTitle('Slides preview')).toBeInTheDocument()
  })

  it('renders singular label for one slide', () => {
    renderPreviewPane({ slideCount: 1 })

    expect(screen.getByText('1 slide')).toBeInTheDocument()
  })

  it('shows preview diagnostics', () => {
    renderPreviewPane({
      slideCount: 2,
      diagnosticErrors: ['Failed to load IMG: https://example.com/marp.svg']
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Preview issues detected. PDF export is disabled until they are resolved.')
    expect(screen.getByText('Failed to load IMG: https://example.com/marp.svg')).toBeInTheDocument()
  })

  it('shows diagnostics pending notice', () => {
    renderPreviewPane({ slideCount: 2, diagnosticsPending: true })

    expect(screen.getByRole('status')).toHaveTextContent('Checking external resources used by slides...')
  })

  it('shows preview error', () => {
    renderPreviewPane({ slideCount: 2, errorMessage: 'Render failed' })

    expect(screen.getByRole('alert')).toHaveTextContent('Render failed')
    expect(screen.queryByTitle('Slides preview')).not.toBeInTheDocument()
  })

  it('calls preview selection handlers', async () => {
    const onThemeNameChange = vi.fn()
    const onSizePresetChange = vi.fn()
    renderPreviewPane({ onThemeNameChange, onSizePresetChange })

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Theme'), 'gaia')
    await user.selectOptions(screen.getByLabelText('Size preset'), '4:3')

    expect(onThemeNameChange).toHaveBeenCalledWith('gaia')
    expect(onSizePresetChange).toHaveBeenCalledWith('4:3')
  })
})
