import { type Dependencies, type IncludedDependencies, type ProjectManifest } from '@pnpm/types'

export function filterDependenciesByType (
  manifest: ProjectManifest,
  include: IncludedDependencies
): Dependencies {
  const depsIterator = include.dependencies ? manifest.dependencies?.entries() ?? [] : []
  const deps = new Map<string, string>(depsIterator)

  if (include.devDependencies) {
    for (const [name, spec] of manifest.devDependencies?.entries() ?? []) {
      deps.set(name, spec)
    }
  }

  if (include.optionalDependencies) {
    for (const [name, spec] of manifest.optionalDependencies?.entries() ?? []) {
      deps.set(name, spec)
    }
  }

  return deps
}
