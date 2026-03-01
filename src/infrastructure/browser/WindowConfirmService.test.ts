import { describe, expect, it, vi } from 'vitest'
import { WindowConfirmService } from './WindowConfirmService'

describe('WindowConfirmService', () => {
  it('delegates to provided confirm function', () => {
    const confirmFn = vi.fn(() => true)
    const service = new WindowConfirmService({ confirmFn })

    const result = service.confirm('Replace markdown?')

    expect(result).toBe(true)
    expect(confirmFn).toHaveBeenCalledWith('Replace markdown?')
  })

  it('uses window.confirm by default', () => {
    const originalConfirm = window.confirm
    const confirmSpy = vi.fn(() => false)
    ;(window as unknown as { confirm: (message: string) => boolean }).confirm = confirmSpy
    const service = new WindowConfirmService()

    const result = service.confirm('Replace markdown?')

    expect(result).toBe(false)
    expect(confirmSpy).toHaveBeenCalledWith('Replace markdown?')
    ;(window as unknown as { confirm: typeof originalConfirm }).confirm = originalConfirm
  })
})
