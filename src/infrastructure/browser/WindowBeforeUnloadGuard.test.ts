import { describe, expect, it, vi } from 'vitest'
import { WindowBeforeUnloadGuard } from './WindowBeforeUnloadGuard'

describe('WindowBeforeUnloadGuard', () => {
  it('registers and unregisters beforeunload listener', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()

    const guard = new WindowBeforeUnloadGuard({
      target: {
        addEventListener,
        removeEventListener
      }
    })

    const detach = guard.attach(() => false)
    expect(addEventListener).toHaveBeenCalledTimes(1)

    detach()
    expect(removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('blocks unload when predicate returns true', () => {
    let capturedHandler: ((event: BeforeUnloadEvent) => void) | null = null

    const guard = new WindowBeforeUnloadGuard({
      target: {
        addEventListener: (_, handler) => {
          capturedHandler = handler
        },
        removeEventListener: vi.fn()
      }
    })

    guard.attach(() => true)

    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined
    } as unknown as BeforeUnloadEvent

    capturedHandler?.(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.returnValue).toBe('')
  })

  it('does nothing when predicate returns false', () => {
    let capturedHandler: ((event: BeforeUnloadEvent) => void) | null = null

    const guard = new WindowBeforeUnloadGuard({
      target: {
        addEventListener: (_, handler) => {
          capturedHandler = handler
        },
        removeEventListener: vi.fn()
      }
    })

    guard.attach(() => false)

    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined
    } as unknown as BeforeUnloadEvent

    capturedHandler?.(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.returnValue).toBeUndefined()
  })
})
