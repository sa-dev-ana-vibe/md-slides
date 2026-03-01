import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PreviewPane } from './PreviewPane'

describe('PreviewPane', () => {
  it('renders placeholder for zero slides', () => {
    render(<PreviewPane documentHtml="<html></html>" slideCount={0} diagnosticErrors={[]} errorMessage={null} />)

    expect(screen.getByText('0 slides')).toBeInTheDocument()
    expect(screen.getByText('Start typing markdown to generate slides.')).toBeInTheDocument()
    expect(screen.getByTitle('Slides preview')).toBeInTheDocument()
  })

  it('renders singular label for one slide', () => {
    render(<PreviewPane documentHtml="<html></html>" slideCount={1} diagnosticErrors={[]} errorMessage={null} />)

    expect(screen.getByText('1 slide')).toBeInTheDocument()
  })

  it('shows preview diagnostics', () => {
    render(
      <PreviewPane
        documentHtml="<html></html>"
        slideCount={2}
        diagnosticErrors={['Failed to load IMG: https://example.com/marp.svg']}
        errorMessage={null}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Preview issues detected. PDF export is disabled until they are resolved.')
    expect(screen.getByText('Failed to load IMG: https://example.com/marp.svg')).toBeInTheDocument()
  })

  it('shows preview error', () => {
    render(<PreviewPane documentHtml="<html></html>" slideCount={2} diagnosticErrors={[]} errorMessage="Render failed" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Render failed')
    expect(screen.queryByTitle('Slides preview')).not.toBeInTheDocument()
  })
})
