import { type Dependencies, type DependencyManifest, type DependenciesMeta } from '@pnpm/types'

export interface WantedDependency {
  alias: string
  pref: string // package reference
  dev: boolean
  optional: boolean
  injected?: boolean
}

export function getNonDevWantedDependencies (pkg: Pick<DependencyManifest, 'bundleDependencies' | 'optionalDependencies' | 'dependencies' | 'dependenciesMeta'>) {
  const bd = pkg.bundleDependencies ?? pkg.bundleDependencies
  const bundledDeps = new Set(Array.isArray(bd) ? bd : [])

  const options = {
    dependenciesMeta: pkg.dependenciesMeta ?? {},
    devDependencies: new Map(),
    optionalDependencies: pkg.optionalDependencies ?? new Map(),
    bundledDeps,
  }

  const wantedDeps: WantedDependency[] = [];

  if (pkg.dependencies)
    addWantedDependenciesFromGivenSet(wantedDeps, pkg.dependencies, options)

  if (pkg.optionalDependencies)
    addWantedDependenciesFromGivenSet(wantedDeps, pkg.optionalDependencies, options)

  return wantedDeps
  // const filterDeps = getNotBundledDeps.bind(null, bundledDeps)
  // return getWantedDependenciesFromGivenSet(
  //   filterDeps({ ...pkg.optionalDependencies, ...pkg.dependencies }),
  //   {
  //     dependenciesMeta: pkg.dependenciesMeta ?? {},
  //     devDependencies: new Map(),
  //     optionalDependencies: pkg.optionalDependencies ?? new Map(),
  //   }
  // )
}

function addWantedDependenciesFromGivenSet (
  wantedDeps: WantedDependency[],
  deps: Dependencies,
  opts: {
    devDependencies: Dependencies
    optionalDependencies: Dependencies
    dependenciesMeta: DependenciesMeta,
    bundledDeps: Set<string>,
  }
): void {
  if (!deps) return

  for (const [alias, pref] of deps.entries()) {
    if (opts.bundledDeps.has(alias))
      continue;

    wantedDeps.push({
      alias,
      dev: opts.devDependencies.has(alias),
      injected: opts.dependenciesMeta[alias]?.injected,
      optional: opts.optionalDependencies.has(alias),
      pref,
    });
  }
}

// function getNotBundledDeps (bundledDeps: Set<string>, deps: Dependencies): Map<string, string> {
//   return pickBy((_, depName) => !bundledDeps.has(depName as string), deps)
// }
