import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PreviewPane } from './PreviewPane'

describe('PreviewPane', () => {
  it('renders placeholder for zero slides', () => {
    render(<PreviewPane documentHtml="<html></html>" slideCount={0} errorMessage={null} />)

    expect(screen.getByText('0 slides')).toBeInTheDocument()
    expect(screen.getByText('Start typing markdown to generate slides.')).toBeInTheDocument()
    expect(screen.getByTitle('Slides preview')).toBeInTheDocument()
  })

  it('renders singular label for one slide', () => {
    render(<PreviewPane documentHtml="<html></html>" slideCount={1} errorMessage={null} />)

    expect(screen.getByText('1 slide')).toBeInTheDocument()
  })

  it('shows preview error', () => {
    render(<PreviewPane documentHtml="<html></html>" slideCount={2} errorMessage="Render failed" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Render failed')
    expect(screen.queryByTitle('Slides preview')).not.toBeInTheDocument()
  })
})
