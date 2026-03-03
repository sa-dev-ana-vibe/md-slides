import { describe, expect, it } from 'vitest'
import { getBuiltInThemeNames, mergeThemeNames } from './themeNames'

describe('themeNames', () => {
  it('lists built-in marp themes', () => {
    const themeNames = getBuiltInThemeNames()

    expect(themeNames).toContain('default')
    expect(themeNames).toContain('gaia')
    expect(themeNames).toContain('uncover')
  })

  it('merges, trims and deduplicates names while preserving first seen names', () => {
    const merged = mergeThemeNames(['  gaia ', 'uncover', 'gaia'], ['Custom', 'custom', ''])

    expect(merged).toEqual(['gaia', 'uncover', 'Custom'])
  })

  it('moves default to first position when present', () => {
    const merged = mergeThemeNames(['gaia', 'default', 'uncover'], ['beta'])

    expect(merged).toEqual(['default', 'gaia', 'uncover', 'beta'])
  })

  it('falls back to default when no valid names are provided', () => {
    const merged = mergeThemeNames([], ['', '   '])

    expect(merged).toEqual(['default'])
  })
})
