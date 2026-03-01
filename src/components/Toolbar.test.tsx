import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  it('triggers all actions', async () => {
    const onOpenMarkdown = vi.fn()
    const onExportHtml = vi.fn()
    const onExportPdf = vi.fn()
    const onExportPptx = vi.fn()

    render(
      <Toolbar
        canExport={true}
        busyAction={null}
        onOpenMarkdown={onOpenMarkdown}
        onExportHtml={onExportHtml}
        onExportPdf={onExportPdf}
        onExportPptx={onExportPptx}
      />
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open .md' }))
    await user.click(screen.getByRole('button', { name: 'Export HTML' }))
    await user.click(screen.getByRole('button', { name: 'Export PDF' }))
    await user.click(screen.getByRole('button', { name: 'Export PPTX' }))

    expect(onOpenMarkdown).toHaveBeenCalledTimes(1)
    expect(onExportHtml).toHaveBeenCalledTimes(1)
    expect(onExportPdf).toHaveBeenCalledTimes(1)
    expect(onExportPptx).toHaveBeenCalledTimes(1)
  })

  it('disables export actions when no markdown exists', () => {
    render(
      <Toolbar
        canExport={false}
        busyAction={null}
        onOpenMarkdown={vi.fn()}
        onExportHtml={vi.fn()}
        onExportPdf={vi.fn()}
        onExportPptx={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export PPTX' })).toBeDisabled()
  })

  it('shows busy labels and disables controls while action is running', () => {
    render(
      <Toolbar
        canExport={true}
        busyAction="pdf"
        onOpenMarkdown={vi.fn()}
        onExportHtml={vi.fn()}
        onExportPdf={vi.fn()}
        onExportPptx={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Exporting PDF...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open .md' })).toBeDisabled()
  })
})
