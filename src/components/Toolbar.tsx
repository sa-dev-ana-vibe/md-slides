import type { ExportFormat } from '../domain/types'

interface ToolbarProps {
  canExportHtml: boolean
  canExportPdf: boolean
  busyAction: ExportFormat | 'open' | null
  pdfDisabledReason?: string
  onOpenMarkdown: () => void
  onExportHtml: () => void
  onExportPdf: () => void
}

function buttonClass(disabled: boolean): string {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    disabled
      ? 'cursor-not-allowed bg-slate-200 text-slate-500'
      : 'bg-slate-900 text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500'
  ].join(' ')
}

export function Toolbar({
  canExportHtml,
  canExportPdf,
  busyAction,
  pdfDisabledReason,
  onOpenMarkdown,
  onExportHtml,
  onExportPdf
}: ToolbarProps) {
  const controlsDisabled = busyAction !== null
  const htmlDisabled = controlsDisabled || !canExportHtml
  const pdfDisabled = controlsDisabled || !canExportPdf

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Toolbar">
      <button type="button" className={buttonClass(controlsDisabled)} onClick={onOpenMarkdown} disabled={controlsDisabled}>
        {busyAction === 'open' ? 'Opening...' : 'Open .md'}
      </button>
      <button type="button" className={buttonClass(htmlDisabled)} onClick={onExportHtml} disabled={htmlDisabled}>
        {busyAction === 'html' ? 'Exporting HTML...' : 'Export HTML'}
      </button>
      <button
        type="button"
        className={buttonClass(pdfDisabled)}
        onClick={onExportPdf}
        disabled={pdfDisabled}
        title={pdfDisabled && pdfDisabledReason ? pdfDisabledReason : undefined}
      >
        {busyAction === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
      </button>
    </div>
  )
}
