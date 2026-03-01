import type { ReactElement } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'

export interface MarkdownEditorAdapterProps {
  value: string
  onChange: (value: string) => void
}

export type MarkdownEditorComponent = (props: MarkdownEditorAdapterProps) => ReactElement

export function CodeMirrorMarkdownEditor({ value, onChange }: MarkdownEditorAdapterProps) {
  return (
    <CodeMirror
      value={value}
      extensions={[markdown()]}
      height="100%"
      onChange={onChange}
      placeholder="Type markdown slides here..."
      basicSetup={{
        foldGutter: false,
        dropCursor: false,
        allowMultipleSelections: false
      }}
    />
  )
}

interface MarkdownEditorPaneProps {
  value: string
  onChange: (value: string) => void
  EditorComponent?: MarkdownEditorComponent
}

export function MarkdownEditorPane({ value, onChange, EditorComponent = CodeMirrorMarkdownEditor }: MarkdownEditorPaneProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Markdown</div>
      <div className="h-[420px] flex-1 p-2" data-testid="markdown-editor-pane">
        <EditorComponent value={value} onChange={onChange} />
      </div>
    </div>
  )
}
