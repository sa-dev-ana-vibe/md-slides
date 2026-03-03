import type { ReactElement } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { useI18n } from '../i18n/I18nContext'

export interface MarkdownEditorAdapterProps {
  value: string
  onChange: (value: string) => void
}

export type MarkdownEditorComponent = (props: MarkdownEditorAdapterProps) => ReactElement
const MARKDOWN_EXTENSIONS = [markdown()]

export function CodeMirrorMarkdownEditor({ value, onChange }: MarkdownEditorAdapterProps) {
  const { messages } = useI18n()

  return (
    <CodeMirror
      value={value}
      extensions={MARKDOWN_EXTENSIONS}
      height="100%"
      onChange={onChange}
      placeholder={messages.markdownPlaceholder}
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
  const { messages } = useI18n()

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {messages.markdownLabel}
      </div>
      <div className="h-[420px] flex-1 p-2" data-testid="markdown-editor-pane">
        <EditorComponent value={value} onChange={onChange} />
      </div>
    </div>
  )
}
