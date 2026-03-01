import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from './I18nContext'

function LocaleProbe() {
  const { locale, setLocale, messages } = useI18n()

  return (
    <div>
      <span data-testid="locale-value">{locale}</span>
      <span>{messages.appTitle}</span>
      <button type="button" onClick={() => setLocale('ru')}>
        Switch to ru
      </button>
    </div>
  )
}

describe('I18nContext', () => {
  it('uses default english locale without provider', () => {
    render(<LocaleProbe />)

    expect(screen.getByTestId('locale-value')).toHaveTextContent('en')
    expect(screen.getByText('MD Slides')).toBeInTheDocument()
  })

  it('respects initial locale and updates locale via setLocale', async () => {
    render(
      <I18nProvider initialLocale="kk">
        <LocaleProbe />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale-value')).toHaveTextContent('kk')
    expect(screen.getByText('MD Слайдтар')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Switch to ru' }))

    expect(screen.getByTestId('locale-value')).toHaveTextContent('ru')
    expect(screen.getByText('MD Слайды')).toBeInTheDocument()
  })

  it('detects locale from browser locale source when initial locale is not provided', () => {
    render(
      <I18nProvider navigatorLocaleSource={{ languages: ['fr-FR', 'ru-RU'], language: 'en-US' }}>
        <LocaleProbe />
      </I18nProvider>
    )

    expect(screen.getByTestId('locale-value')).toHaveTextContent('ru')
    expect(screen.getByText('MD Слайды')).toBeInTheDocument()
  })
})
