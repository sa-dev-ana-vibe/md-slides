import { Marp } from '@marp-team/marp-core'

function normalizeThemeName(name: string): string | null {
  const normalizedName = name.trim()
  return normalizedName.length > 0 ? normalizedName : null
}

export function getBuiltInThemeNames(): string[] {
  const marp = new Marp()
  return Array.from(marp.themeSet.themes(), (theme) => theme.name)
}

export function mergeThemeNames(builtInThemeNames: readonly string[], customThemeNames: readonly string[] = []): string[] {
  const mergedThemeNames: string[] = []
  const seenThemeNames = new Set<string>()

  for (const sourceName of [...builtInThemeNames, ...customThemeNames]) {
    const normalizedName = normalizeThemeName(sourceName)

    if (!normalizedName) {
      continue
    }

    const dedupeKey = normalizedName.toLowerCase()

    if (seenThemeNames.has(dedupeKey)) {
      continue
    }

    seenThemeNames.add(dedupeKey)
    mergedThemeNames.push(normalizedName)
  }

  if (mergedThemeNames.length === 0) {
    return ['default']
  }

  const defaultThemeIndex = mergedThemeNames.findIndex((themeName) => themeName.toLowerCase() === 'default')

  if (defaultThemeIndex > 0) {
    const [defaultThemeName] = mergedThemeNames.splice(defaultThemeIndex, 1)
    mergedThemeNames.unshift(defaultThemeName)
  }

  return mergedThemeNames
}
