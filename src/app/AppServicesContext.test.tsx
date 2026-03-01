import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppServicesProvider, useAppServices } from './AppServicesContext'
import { createFakeServices } from '../test/fakes'

function ServiceConsumer() {
  const services = useAppServices()
  return <span>{typeof services.renderer.render}</span>
}

describe('AppServicesContext', () => {
  it('provides services from provider', () => {
    const { services } = createFakeServices()

    render(
      <AppServicesProvider services={services}>
        <ServiceConsumer />
      </AppServicesProvider>
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('throws when used without provider', () => {
    expect(() => render(<ServiceConsumer />)).toThrow('useAppServices must be used within AppServicesProvider')
  })
})
