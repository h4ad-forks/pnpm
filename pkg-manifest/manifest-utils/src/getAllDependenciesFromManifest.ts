import { type Dependencies, type DependenciesField, type ProjectManifest } from '@pnpm/types'

export function getAllDependenciesFromManifest (
  pkg: Pick<ProjectManifest, DependenciesField>
): Dependencies {
  const map = new Map(pkg.devDependencies?.entries())

  for (const [name, spec] of pkg.dependencies?.entries() ?? []) {
    map.set(name, spec)
  }

  for (const [name, spec] of pkg.optionalDependencies?.entries() ?? []) {
    map.set(name, spec)
  }

  return map
}
