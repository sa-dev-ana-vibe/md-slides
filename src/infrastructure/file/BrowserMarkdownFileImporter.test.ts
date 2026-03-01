import { describe, expect, it, vi } from 'vitest'
import { BrowserMarkdownFileImporter, type FileInputLike } from './BrowserMarkdownFileImporter'

function createFakeFileList(files: File[]): FileList {
  return {
    length: files.length,
    item(index: number) {
      return files[index] ?? null
    },
    [Symbol.iterator]: function* iterator() {
      yield* files
    },
    ...files
  } as unknown as FileList
}

describe('BrowserMarkdownFileImporter', () => {
  it('reads selected markdown file', async () => {
    const file = new File(['# imported'], 'deck.md', { type: 'text/markdown' })
    const listeners: Array<() => void> = []

    const input: FileInputLike = {
      type: '',
      accept: '',
      files: createFakeFileList([file]),
      addEventListener: vi.fn((name: 'change', handler: () => void) => {
        if (name === 'change') {
          listeners.push(handler)
        }
      }),
      click: vi.fn(() => {
        listeners.forEach((listener) => listener())
      })
    }

    const importer = new BrowserMarkdownFileImporter({ createInput: () => input })

    await expect(importer.pickAndRead()).resolves.toBe('# imported')
    expect(input.type).toBe('file')
    expect(input.accept).toContain('.md')
  })

  it('returns null when no file was selected', async () => {
    const listeners: Array<() => void> = []

    const input: FileInputLike = {
      type: '',
      accept: '',
      files: null,
      addEventListener: vi.fn((name: 'change', handler: () => void) => {
        if (name === 'change') {
          listeners.push(handler)
        }
      }),
      click: vi.fn(() => {
        listeners.forEach((listener) => listener())
      })
    }

    const importer = new BrowserMarkdownFileImporter({ createInput: () => input })

    await expect(importer.pickAndRead()).resolves.toBeNull()
  })

  it('reads dropped file', async () => {
    const importer = new BrowserMarkdownFileImporter()
    const file = new File(['# dropped'], 'deck.md', { type: 'text/markdown' })

    await expect(importer.readDropped(file)).resolves.toBe('# dropped')
  })

  it('uses default document.createElement input factory', async () => {
    const file = new File(['# default'], 'deck.md', { type: 'text/markdown' })
    const listeners: Array<() => void> = []

    const fakeInput: FileInputLike = {
      type: '',
      accept: '',
      files: createFakeFileList([file]),
      addEventListener: vi.fn((name: 'change', handler: () => void) => {
        if (name === 'change') {
          listeners.push(handler)
        }
      }),
      click: vi.fn(() => {
        listeners.forEach((listener) => listener())
      })
    }

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'input') {
        return fakeInput as unknown as HTMLInputElement
      }

      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName)
    })

    const importer = new BrowserMarkdownFileImporter()
    await expect(importer.pickAndRead()).resolves.toBe('# default')
    expect(createElementSpy).toHaveBeenCalledWith('input')
    createElementSpy.mockRestore()
  })
})
