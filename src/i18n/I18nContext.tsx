import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'
import { DEFAULT_LOCALE, detectBrowserLocale, getMessages, type AppLocale, type AppMessages, type NavigatorLocaleSource } from './messages'

export interface I18nContextValue {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  messages: AppMessages
}

const defaultContextValue: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  messages: getMessages(DEFAULT_LOCALE)
}

const I18nContext = createContext<I18nContextValue>(defaultContextValue)

interface I18nProviderProps extends PropsWithChildren {
  initialLocale?: AppLocale
  navigatorLocaleSource?: NavigatorLocaleSource
}

export function I18nProvider({ children, initialLocale, navigatorLocaleSource }: I18nProviderProps) {
  const [locale, setLocale] = useState<AppLocale>(() => initialLocale ?? detectBrowserLocale(navigatorLocaleSource))
  const messages = useMemo(() => getMessages(locale), [locale])
  const value = useMemo(() => ({ locale, setLocale, messages }), [locale, messages])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
