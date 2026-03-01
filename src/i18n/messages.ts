const RUSSIAN_SLIDE_PLURAL_RULES = new Intl.PluralRules('ru')

export interface AppMessages {
  appTitle: string
  appSubtitle: string
  toolbarLabel: string
  languageLabel: string
  openMarkdown: string
  openingMarkdown: string
  exportHtml: string
  exportingHtml: string
  exportPdf: string
  exportingPdf: string
  addMarkdownToEnablePdfExport: string
  checkingPreviewResourcesToEnablePdfExport: string
  resolvePreviewLoadingErrorsToExportPdf: string
  replaceMarkdownConfirm: string
  unknownError: string
  failedToOpenMarkdownFile: (error: string) => string
  failedToReadDroppedFile: (error: string) => string
  failedToExportHtml: (error: string) => string
  failedToExportPdf: (error: string) => string
  previewDocumentTitle: string
  previewLabel: string
  slideCount: (count: number) => string
  previewIssuesDetected: string
  previewDiagnosticsInProgress: string
  startTypingMarkdownToGenerateSlides: string
  slidesPreview: string
  markdownLabel: string
  markdownPlaceholder: string
  dropMarkdownFileToReplaceEditorContent: string
}

export const SUPPORTED_LOCALES = ['en', 'ru', 'kk'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = 'en'

export const LOCALE_OPTIONS: ReadonlyArray<{ value: AppLocale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'kk', label: 'Қазақша' }
]

const englishMessages: AppMessages = {
  appTitle: 'MD Slides',
  appSubtitle: 'Create Marp slides from markdown, fully in the browser.',
  toolbarLabel: 'Toolbar',
  languageLabel: 'Language',
  openMarkdown: 'Open .md',
  openingMarkdown: 'Opening...',
  exportHtml: 'Export HTML',
  exportingHtml: 'Exporting HTML...',
  exportPdf: 'Export PDF',
  exportingPdf: 'Exporting PDF...',
  addMarkdownToEnablePdfExport: 'Add markdown to enable PDF export.',
  checkingPreviewResourcesToEnablePdfExport: 'Checking external resources before enabling PDF export.',
  resolvePreviewLoadingErrorsToExportPdf: 'Resolve preview loading errors to export PDF.',
  replaceMarkdownConfirm: 'Current markdown will be replaced. Continue?',
  unknownError: 'Unknown error',
  failedToOpenMarkdownFile: (error) => `Failed to open Markdown file: ${error}`,
  failedToReadDroppedFile: (error) => `Failed to read dropped file: ${error}`,
  failedToExportHtml: (error) => `Failed to export HTML: ${error}`,
  failedToExportPdf: (error) => `Failed to export PDF: ${error}`,
  previewDocumentTitle: 'MD Slides Preview',
  previewLabel: 'Preview',
  slideCount: (count) => `${count} slide${count === 1 ? '' : 's'}`,
  previewIssuesDetected: 'Preview issues detected. PDF export is disabled until they are resolved.',
  previewDiagnosticsInProgress: 'Checking external resources used by slides...',
  startTypingMarkdownToGenerateSlides: 'Start typing markdown to generate slides.',
  slidesPreview: 'Slides preview',
  markdownLabel: 'Markdown',
  markdownPlaceholder: 'Type markdown slides here...',
  dropMarkdownFileToReplaceEditorContent: 'Drop .md file to replace editor content'
}

const russianMessages: AppMessages = {
  appTitle: 'MD Слайды',
  appSubtitle: 'Создавайте слайды Marp из markdown полностью в браузере.',
  toolbarLabel: 'Панель инструментов',
  languageLabel: 'Язык',
  openMarkdown: 'Открыть .md',
  openingMarkdown: 'Открытие...',
  exportHtml: 'Экспорт HTML',
  exportingHtml: 'Экспорт HTML...',
  exportPdf: 'Экспорт PDF',
  exportingPdf: 'Экспорт PDF...',
  addMarkdownToEnablePdfExport: 'Добавьте markdown, чтобы включить экспорт PDF.',
  checkingPreviewResourcesToEnablePdfExport: 'Проверяем внешние ресурсы перед включением экспорта PDF.',
  resolvePreviewLoadingErrorsToExportPdf: 'Исправьте ошибки предпросмотра, чтобы экспортировать PDF.',
  replaceMarkdownConfirm: 'Текущий markdown будет заменен. Продолжить?',
  unknownError: 'Неизвестная ошибка',
  failedToOpenMarkdownFile: (error) => `Не удалось открыть Markdown-файл: ${error}`,
  failedToReadDroppedFile: (error) => `Не удалось прочитать перетащенный файл: ${error}`,
  failedToExportHtml: (error) => `Не удалось экспортировать HTML: ${error}`,
  failedToExportPdf: (error) => `Не удалось экспортировать PDF: ${error}`,
  previewDocumentTitle: 'Предпросмотр MD Слайдов',
  previewLabel: 'Предпросмотр',
  slideCount: (count) => {
    const absCount = Math.abs(count)
    const pluralCategory = RUSSIAN_SLIDE_PLURAL_RULES.select(absCount)
    const suffix = pluralCategory === 'one' ? 'слайд' : pluralCategory === 'few' ? 'слайда' : 'слайдов'
    return `${count} ${suffix}`
  },
  previewIssuesDetected: 'Обнаружены проблемы предпросмотра. Экспорт PDF отключен, пока они не будут исправлены.',
  previewDiagnosticsInProgress: 'Проверяем внешние ресурсы, используемые в слайдах...',
  startTypingMarkdownToGenerateSlides: 'Начните вводить markdown, чтобы создать слайды.',
  slidesPreview: 'Предпросмотр слайдов',
  markdownLabel: 'Markdown',
  markdownPlaceholder: 'Введите markdown для слайдов...',
  dropMarkdownFileToReplaceEditorContent: 'Перетащите .md файл, чтобы заменить содержимое редактора'
}

const kazakhMessages: AppMessages = {
  appTitle: 'MD Слайдтар',
  appSubtitle: 'Marp слайдтарын markdown-нан браузерде жасаңыз.',
  toolbarLabel: 'Құралдар панелі',
  languageLabel: 'Тіл',
  openMarkdown: '.md ашу',
  openingMarkdown: 'Ашылуда...',
  exportHtml: 'HTML экспорттау',
  exportingHtml: 'HTML экспортталуда...',
  exportPdf: 'PDF экспорттау',
  exportingPdf: 'PDF экспортталуда...',
  addMarkdownToEnablePdfExport: 'PDF экспортын қосу үшін markdown енгізіңіз.',
  checkingPreviewResourcesToEnablePdfExport: 'PDF экспортын қоспас бұрын сыртқы ресурстар тексерілуде.',
  resolvePreviewLoadingErrorsToExportPdf: 'PDF экспорттау үшін алдын ала қарау қателерін түзетіңіз.',
  replaceMarkdownConfirm: 'Ағымдағы markdown ауыстырылады. Жалғастырасыз ба?',
  unknownError: 'Белгісіз қате',
  failedToOpenMarkdownFile: (error) => `Markdown файлын ашу мүмкін болмады: ${error}`,
  failedToReadDroppedFile: (error) => `Тасталған файлды оқу мүмкін болмады: ${error}`,
  failedToExportHtml: (error) => `HTML экспорттау сәтсіз аяқталды: ${error}`,
  failedToExportPdf: (error) => `PDF экспорттау сәтсіз аяқталды: ${error}`,
  previewDocumentTitle: 'MD Слайдтар алдын ала қарау',
  previewLabel: 'Алдын ала қарау',
  slideCount: (count) => `${count} слайд`,
  previewIssuesDetected: 'Алдын ала қарау мәселелері анықталды. Мәселелер түзетілгенше PDF экспорты өшірілді.',
  previewDiagnosticsInProgress: 'Слайдтардағы сыртқы ресурстар тексерілуде...',
  startTypingMarkdownToGenerateSlides: 'Слайдтар жасау үшін markdown жаза бастаңыз.',
  slidesPreview: 'Слайдтарды алдын ала қарау',
  markdownLabel: 'Markdown',
  markdownPlaceholder: 'Слайдтарға арналған markdown мәтінін жазыңыз...',
  dropMarkdownFileToReplaceEditorContent: '.md файлын редактор мазмұнын ауыстыру үшін осында тастаңыз'
}

const MESSAGES_BY_LOCALE: Record<AppLocale, AppMessages> = {
  en: englishMessages,
  ru: russianMessages,
  kk: kazakhMessages
}

export interface NavigatorLocaleSource {
  language?: string
  languages?: readonly string[]
}

export function parseLocaleFromLanguageTag(languageTag: string): AppLocale | null {
  const normalizedLanguageTag = languageTag.trim().toLowerCase()

  if (normalizedLanguageTag.length === 0) {
    return null
  }

  for (const locale of SUPPORTED_LOCALES) {
    if (normalizedLanguageTag === locale || normalizedLanguageTag.startsWith(`${locale}-`)) {
      return locale
    }
  }

  return null
}

export function detectLocaleFromLanguages(
  languages: readonly string[] | undefined,
  fallbackLocale: AppLocale = DEFAULT_LOCALE
): AppLocale {
  if (!languages || languages.length === 0) {
    return fallbackLocale
  }

  for (const language of languages) {
    const locale = parseLocaleFromLanguageTag(language)

    if (locale) {
      return locale
    }
  }

  return fallbackLocale
}

export function detectBrowserLocale(navigatorLocaleSource?: NavigatorLocaleSource | null): AppLocale {
  const source = navigatorLocaleSource ?? (typeof navigator === 'undefined' ? null : navigator)

  if (!source) {
    return DEFAULT_LOCALE
  }

  const browserLanguages = [
    ...(source.languages ?? []),
    ...(source.language ? [source.language] : [])
  ]

  return detectLocaleFromLanguages(browserLanguages)
}

export function getMessages(locale: AppLocale): AppMessages {
  return MESSAGES_BY_LOCALE[locale]
}
