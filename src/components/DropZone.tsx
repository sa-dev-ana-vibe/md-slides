import { useRef, useState, type DragEvent, type PropsWithChildren } from 'react'
import { useI18n } from '../i18n/I18nContext'

export function isMarkdownFile(file: File): boolean {
  const normalizedName = file.name.toLowerCase()
  const normalizedType = file.type.toLowerCase()

  if (normalizedName.endsWith('.md') || normalizedName.endsWith('.markdown')) {
    return true
  }

  return normalizedType === 'text/markdown'
}

export function pickFirstMarkdownFile(dataTransfer: { files?: FileList | File[] | null } | null): File | null {
  if (!dataTransfer?.files || dataTransfer.files.length === 0) {
    return null
  }

  for (const file of Array.from(dataTransfer.files)) {
    if (isMarkdownFile(file)) {
      return file
    }
  }

  return null
}

interface DropZoneProps extends PropsWithChildren {
  onMarkdownFileDrop: (file: File) => void | Promise<void>
}

export function DropZone({ children, onMarkdownFileDrop }: DropZoneProps) {
  const { messages } = useI18n()
  const [isActive, setIsActive] = useState(false)
  const dragDepthRef = useRef(0)

  const activate = () => {
    setIsActive(true)
  }

  const deactivate = () => {
    setIsActive(false)
    dragDepthRef.current = 0
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!pickFirstMarkdownFile(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    dragDepthRef.current += 1
    activate()
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!pickFirstMarkdownFile(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    activate()
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!pickFirstMarkdownFile(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

    if (dragDepthRef.current === 0) {
      deactivate()
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const markdownFile = pickFirstMarkdownFile(event.dataTransfer)
    deactivate()

    if (!markdownFile) {
      return
    }

    void onMarkdownFileDrop(markdownFile)
  }

  return (
    <div
      className="relative"
      data-testid="markdown-drop-zone"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      <div
        className={[
          'pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-100/90 text-sm font-medium text-blue-700 transition-opacity',
          isActive ? 'opacity-100' : 'opacity-0'
        ].join(' ')}
      >
        {messages.dropMarkdownFileToReplaceEditorContent}
      </div>
    </div>
  )
}
