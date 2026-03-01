interface PreviewPaneProps {
  documentHtml: string
  slideCount: number
  errorMessage?: string | null
}

export function PreviewPane({ documentHtml, slideCount, errorMessage }: PreviewPaneProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Preview</span>
        <span className="text-xs text-slate-500">{slideCount} slide{slideCount === 1 ? '' : 's'}</span>
      </div>
      {errorMessage ? (
        <div className="flex flex-1 items-center justify-center px-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </div>
      ) : (
        <>
          {slideCount === 0 && (
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Start typing markdown to generate slides.
            </div>
          )}
          <iframe
            title="Slides preview"
            srcDoc={documentHtml}
            className="h-[420px] w-full flex-1 bg-slate-100"
            sandbox="allow-scripts"
          />
        </>
      )}
    </div>
  )
}
