import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  SUPPORTED_LOCALES,
  detectBrowserLocale,
  detectLocaleFromLanguages,
  getMessages,
  parseLocaleFromLanguageTag
} from './messages'

describe('messages', () => {
  it('exposes supported locales and language options', () => {
    expect(DEFAULT_LOCALE).toBe('en')
    expect(SUPPORTED_LOCALES).toEqual(['en', 'ru', 'kk'])
    expect(LOCALE_OPTIONS).toEqual([
      { value: 'en', label: 'English' },
      { value: 'ru', label: 'Русский' },
      { value: 'kk', label: 'Қазақша' }
    ])
  })

  it('provides expected english text and interpolation', () => {
    const messages = getMessages('en')

    expect(messages.appTitle).toBe('MD Slides')
    expect(messages.slideCount(1)).toBe('1 slide')
    expect(messages.slideCount(2)).toBe('2 slides')
    expect(messages.enterPresentation).toBe('Present')
    expect(messages.presentationModeLabel).toBe('Presentation mode')
    expect(messages.exitPresentation).toBe('Exit presentation')
    expect(messages.slidesPresentation).toBe('Slides presentation')
    expect(messages.failedToOpenMarkdownFile('boom')).toBe('Failed to open Markdown file: boom')
    expect(messages.failedToReadDroppedFile('boom')).toBe('Failed to read dropped file: boom')
    expect(messages.failedToExportHtml('boom')).toBe('Failed to export HTML: boom')
    expect(messages.failedToExportPdf('boom')).toBe('Failed to export PDF: boom')
  })

  it('provides russian slide plural forms and interpolation', () => {
    const messages = getMessages('ru')

    expect(messages.appTitle).toBe('MD Слайды')
    expect(messages.slideCount(1)).toBe('1 слайд')
    expect(messages.slideCount(2)).toBe('2 слайда')
    expect(messages.slideCount(5)).toBe('5 слайдов')
    expect(messages.enterPresentation).toBe('Презентация')
    expect(messages.presentationModeLabel).toBe('Режим презентации')
    expect(messages.exitPresentation).toBe('Выйти из презентации')
    expect(messages.slidesPresentation).toBe('Показ слайдов')
    expect(messages.failedToOpenMarkdownFile('ошибка')).toBe('Не удалось открыть Markdown-файл: ошибка')
    expect(messages.failedToReadDroppedFile('ошибка')).toBe('Не удалось прочитать перетащенный файл: ошибка')
    expect(messages.failedToExportHtml('ошибка')).toBe('Не удалось экспортировать HTML: ошибка')
    expect(messages.failedToExportPdf('ошибка')).toBe('Не удалось экспортировать PDF: ошибка')
  })

  it('provides kazakh text and interpolation', () => {
    const messages = getMessages('kk')

    expect(messages.appTitle).toBe('MD Слайдтар')
    expect(messages.slideCount(1)).toBe('1 слайд')
    expect(messages.slideCount(8)).toBe('8 слайд')
    expect(messages.enterPresentation).toBe('Презентация')
    expect(messages.presentationModeLabel).toBe('Презентация режимі')
    expect(messages.exitPresentation).toBe('Презентациядан шығу')
    expect(messages.slidesPresentation).toBe('Слайд көрсетілімі')
    expect(messages.failedToOpenMarkdownFile('қате')).toBe('Markdown файлын ашу мүмкін болмады: қате')
    expect(messages.failedToReadDroppedFile('қате')).toBe('Тасталған файлды оқу мүмкін болмады: қате')
    expect(messages.failedToExportHtml('қате')).toBe('HTML экспорттау сәтсіз аяқталды: қате')
    expect(messages.failedToExportPdf('қате')).toBe('PDF экспорттау сәтсіз аяқталды: қате')
  })

  it('parses locale from language tag', () => {
    expect(parseLocaleFromLanguageTag('en')).toBe('en')
    expect(parseLocaleFromLanguageTag('en-US')).toBe('en')
    expect(parseLocaleFromLanguageTag('RU-ru')).toBe('ru')
    expect(parseLocaleFromLanguageTag('kk-KZ')).toBe('kk')
    expect(parseLocaleFromLanguageTag('fr-FR')).toBeNull()
    expect(parseLocaleFromLanguageTag('')).toBeNull()
  })

  it('detects locale from languages list with fallback', () => {
    expect(detectLocaleFromLanguages(['fr-FR', 'ru-RU'])).toBe('ru')
    expect(detectLocaleFromLanguages(['fr-FR', 'de-DE'], 'kk')).toBe('kk')
    expect(detectLocaleFromLanguages([])).toBe('en')
    expect(detectLocaleFromLanguages(undefined, 'ru')).toBe('ru')
  })

  it('detects locale from browser locale source', () => {
    expect(detectBrowserLocale({ languages: ['kk-KZ', 'ru-RU'], language: 'en-US' })).toBe('kk')
    expect(detectBrowserLocale({ languages: ['fr-FR'], language: 'ru-RU' })).toBe('ru')
    expect(detectBrowserLocale({ languages: ['fr-FR'], language: 'de-DE' })).toBe(DEFAULT_LOCALE)
    expect(detectBrowserLocale(null)).toBe(DEFAULT_LOCALE)
  })
})
