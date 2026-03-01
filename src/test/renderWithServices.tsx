import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppServicesProvider } from '../app/AppServicesContext'
import type { AppServices } from '../domain/services'
import { I18nProvider } from '../i18n/I18nContext'
import { DEFAULT_LOCALE, type AppLocale } from '../i18n/messages'

interface RenderWithServicesOptions {
  initialLocale?: AppLocale
}

export function renderWithServices(ui: ReactElement, services: AppServices, options: RenderWithServicesOptions = {}) {
  const locale = options.initialLocale ?? DEFAULT_LOCALE

  return render(
    <AppServicesProvider services={services}>
      <I18nProvider initialLocale={locale}>{ui}</I18nProvider>
    </AppServicesProvider>
  )
}
