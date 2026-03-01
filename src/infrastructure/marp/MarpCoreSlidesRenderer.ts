import { Marp } from '@marp-team/marp-core'
import type { RenderResult } from '../../domain/types'
import type { SlidesRenderer } from '../../domain/services'

export class MarpCoreSlidesRenderer implements SlidesRenderer {
  private readonly marp: Marp

  constructor(marp?: Marp) {
    this.marp =
      marp ??
      new Marp({
        math: false,
        emoji: {
          shortcode: true,
          unicode: true
        },
        script: {
          source: 'inline'
        }
      })
  }

  render(markdown: string): RenderResult {
    const { html, css } = this.marp.render(markdown)
    const slideCount = (html.match(/<svg\b[^>]*data-marpit-svg/g) ?? []).length

    return {
      html,
      css,
      slideCount
    }
  }
}
