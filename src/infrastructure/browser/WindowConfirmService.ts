import type { ConfirmService } from '../../domain/services'

interface WindowConfirmServiceDeps {
  confirmFn?: (message: string) => boolean
}

export class WindowConfirmService implements ConfirmService {
  private readonly confirmFn: (message: string) => boolean

  constructor({ confirmFn = (message) => window.confirm(message) }: WindowConfirmServiceDeps = {}) {
    this.confirmFn = confirmFn
  }

  confirm(message: string): boolean {
    return this.confirmFn(message)
  }
}
