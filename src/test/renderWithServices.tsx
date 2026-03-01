import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppServicesProvider } from '../app/AppServicesContext'
import type { AppServices } from '../domain/services'

export function renderWithServices(ui: ReactElement, services: AppServices) {
  return render(<AppServicesProvider services={services}>{ui}</AppServicesProvider>)
}
