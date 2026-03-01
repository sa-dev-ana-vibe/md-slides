import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  it('triggers all actions', async () => {
    const onOpenMarkdown = vi.fn()
    const onExportHtml = vi.fn()
    const onExportPdf = vi.fn()

    render(
      <Toolbar
        canExportHtml={true}
        canExportPdf={true}
        busyAction={null}
        onOpenMarkdown={onOpenMarkdown}
        onExportHtml={onExportHtml}
        onExportPdf={onExportPdf}
      />
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open .md' }))
    await user.click(screen.getByRole('button', { name: 'Export HTML' }))
    await user.click(screen.getByRole('button', { name: 'Export PDF' }))

    expect(onOpenMarkdown).toHaveBeenCalledTimes(1)
    expect(onExportHtml).toHaveBeenCalledTimes(1)
    expect(onExportPdf).toHaveBeenCalledTimes(1)
  })

  it('disables html and pdf export independently', () => {
    render(
      <Toolbar
        canExportHtml={true}
        canExportPdf={false}
        pdfDisabledReason="Resolve preview loading errors to export PDF."
        busyAction={null}
        onOpenMarkdown={vi.fn()}
        onExportHtml={vi.fn()}
        onExportPdf={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Export HTML' })).toBeEnabled()

    const pdfButton = screen.getByRole('button', { name: 'Export PDF' })
    expect(pdfButton).toBeDisabled()
    expect(pdfButton).toHaveAttribute('title', 'Resolve preview loading errors to export PDF.')
  })

  it('shows busy labels and disables controls while action is running', () => {
    render(
      <Toolbar
        canExportHtml={true}
        canExportPdf={true}
        busyAction="pdf"
        onOpenMarkdown={vi.fn()}
        onExportHtml={vi.fn()}
        onExportPdf={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Exporting PDF...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open .md' })).toBeDisabled()
  })
})
