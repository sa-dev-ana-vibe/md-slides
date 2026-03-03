import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AskAiModal } from './AskAiModal'

function renderModal(overrides: Partial<ComponentProps<typeof AskAiModal>> = {}) {
  const props: ComponentProps<typeof AskAiModal> = {
    themeNames: ['default', 'gaia', 'uncover'],
    userBrief: 'Current brief',
    themeName: 'default',
    targetSlideCount: 'medium',
    sizePreset: '',
    onUserBriefChange: vi.fn(),
    onThemeNameChange: vi.fn(),
    onTargetSlideCountChange: vi.fn(),
    onSizePresetChange: vi.fn(),
    onClose: vi.fn(),
    onCopyPrompt: vi.fn(),
    onOpenChatGpt: vi.fn(),
    ...overrides
  }

  render(<AskAiModal {...props} />)

  return props
}

describe('AskAiModal', () => {
  it('renders fields and triggers handlers', async () => {
    const props = renderModal()
    const user = userEvent.setup()

    expect(screen.getByRole('dialog', { name: 'Ask AI' })).toBeInTheDocument()
    expect(screen.getByLabelText('Presentation brief')).toHaveValue('Current brief')

    await user.type(screen.getByLabelText('Presentation brief'), ' updated')
    expect(props.onUserBriefChange).toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText('Theme'), 'gaia')
    expect(props.onThemeNameChange).toHaveBeenCalledWith('gaia')

    await user.selectOptions(screen.getByLabelText('Target slide count'), 'large')
    expect(props.onTargetSlideCountChange).toHaveBeenCalledWith('large')

    await user.selectOptions(screen.getByLabelText('Size preset'), '4:3')
    expect(props.onSizePresetChange).toHaveBeenCalledWith('4:3')

    await user.click(screen.getByRole('button', { name: 'Copy Prompt' }))
    await user.click(screen.getByRole('button', { name: 'Open ChatGPT' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(props.onCopyPrompt).toHaveBeenCalledTimes(1)
    expect(props.onOpenChatGpt).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on escape key and close button', async () => {
    const props = renderModal()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })
})
