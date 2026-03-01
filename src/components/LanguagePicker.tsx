import type { ChangeEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { LOCALE_OPTIONS, type AppLocale } from '../i18n/messages'

export function LanguagePicker() {
  const { locale, setLocale, messages } = useI18n()

  const handleLocaleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as AppLocale)
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <span>{messages.languageLabel}</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        value={locale}
        onChange={handleLocaleChange}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
