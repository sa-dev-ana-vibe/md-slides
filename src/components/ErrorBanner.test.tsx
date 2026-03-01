import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders message in alert region', () => {
    render(<ErrorBanner message="Something failed" />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Something failed')
  })
})
