import type { BeforeUnloadGuard } from '../../domain/services'

interface BeforeUnloadTarget {
  addEventListener: (name: 'beforeunload', listener: (event: BeforeUnloadEvent) => void) => void
  removeEventListener: (name: 'beforeunload', listener: (event: BeforeUnloadEvent) => void) => void
}

interface WindowBeforeUnloadGuardDeps {
  target?: BeforeUnloadTarget
}

export class WindowBeforeUnloadGuard implements BeforeUnloadGuard {
  private readonly target: BeforeUnloadTarget

  constructor({ target = window }: WindowBeforeUnloadGuardDeps = {}) {
    this.target = target
  }

  attach(shouldBlock: () => boolean): () => void {
    const handler = (event: BeforeUnloadEvent) => {
      if (!shouldBlock()) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    this.target.addEventListener('beforeunload', handler)

    return () => {
      this.target.removeEventListener('beforeunload', handler)
    }
  }
}
