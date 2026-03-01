import type { MarkdownFileImporter } from '../../domain/services'

export interface FileInputLike {
  type: string
  accept: string
  files: FileList | null
  click: () => void
  addEventListener: (name: 'change', handler: () => void, options?: { once?: boolean }) => void
}

interface BrowserMarkdownFileImporterDeps {
  createInput?: () => FileInputLike
}

export class BrowserMarkdownFileImporter implements MarkdownFileImporter {
  private readonly createInput: () => FileInputLike

  constructor({ createInput = () => document.createElement('input') as unknown as FileInputLike }: BrowserMarkdownFileImporterDeps = {}) {
    this.createInput = createInput
  }

  pickAndRead(): Promise<string | null> {
    const input = this.createInput()
    input.type = 'file'
    input.accept = '.md,.markdown,text/markdown,text/plain'

    return new Promise((resolve) => {
      input.addEventListener(
        'change',
        async () => {
          const file = input.files?.[0]

          if (!file) {
            resolve(null)
            return
          }

          resolve(await file.text())
        },
        { once: true }
      )

      input.click()
    })
  }

  async readDropped(file: File): Promise<string> {
    return file.text()
  }
}
