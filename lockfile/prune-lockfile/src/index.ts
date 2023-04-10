import { LOCKFILE_VERSION } from '@pnpm/constants'
import {
  type Lockfile,
  type PackageSnapshots,
  type ProjectSnapshot,
  type ResolvedDependencies,
} from '@pnpm/lockfile-types'
import { type PackageManifest } from '@pnpm/types'
import { refToRelative } from '@pnpm/dependency-path'
import difference from 'ramda/src/difference'
import isEmpty from 'ramda/src/isEmpty'
import unnest from 'ramda/src/unnest'

export * from '@pnpm/lockfile-types'

export function pruneSharedLockfile (
  lockfile: Lockfile,
  opts?: {
    warn?: (msg: string) => void
  }
) {
  const copiedPackages = (lockfile.packages == null)
    ? new Map()
    : (() => {
      const importersValues = Object.values(lockfile.importers)

      return copyPackageSnapshots(lockfile.packages!, {
        devDepPaths: unnest(importersValues.map((deps) => resolvedDepsToDepPaths(deps.devDependencies ?? new Map()))),
        optionalDepPaths: unnest(importersValues.map((deps) => resolvedDepsToDepPaths(deps.optionalDependencies ?? new Map()))),
        prodDepPaths: unnest(importersValues.map((deps) => resolvedDepsToDepPaths(deps.dependencies ?? new Map()))),
        warn: opts?.warn ?? ((msg: string) => undefined),
      })
    })()

  const prunedLockfile: Lockfile = {
    ...lockfile,
    packages: copiedPackages,
  }
  if (isEmpty(prunedLockfile.packages)) {
    delete prunedLockfile.packages
  }
  return prunedLockfile
}

export function pruneLockfile (
  lockfile: Lockfile,
  pkg: PackageManifest,
  importerId: string,
  opts?: {
    warn?: (msg: string) => void
  }
): Lockfile {
  const packages: PackageSnapshots = new Map()
  const importer = lockfile.importers.get(importerId)!
  const lockfileSpecs: ResolvedDependencies = importer.specifiers ?? new Map()
  const optionalDependencies = Object.keys(pkg.optionalDependencies ?? new Map())
  const dependencies = difference(Object.keys(pkg.dependencies ?? new Map()), optionalDependencies)
  const devDependencies = difference(difference(Object.keys(pkg.devDependencies ?? new Map()), optionalDependencies), dependencies)
  const allDeps = new Set([
    ...optionalDependencies,
    ...devDependencies,
    ...dependencies,
  ])
  const specifiers: ResolvedDependencies = new Map()
  const lockfileDependencies: ResolvedDependencies = new Map()
  const lockfileOptionalDependencies: ResolvedDependencies = new Map()
  const lockfileDevDependencies: ResolvedDependencies = new Map()

  for (const [depName, spec] of lockfileSpecs.entries()) {
    if (!allDeps.has(depName)) continue
    specifiers.set(depName, spec)

    const importerDep = importer.dependencies?.get(depName)
    if (importerDep) {
      lockfileDependencies.set(depName, importerDep)
      continue
    }

    const importerOptionalDep = importer.optionalDependencies?.get(depName)
    if (importerOptionalDep) {
      lockfileOptionalDependencies.set(depName, importerOptionalDep)
      continue
    }

    const importerDevDep = importer.devDependencies?.get(depName)
    if (importerDevDep) {
      lockfileDevDependencies.set(depName, importerDevDep)
    }
  }

  if (importer.dependencies != null) {
    for (const [alias, dep] of Object.entries(importer.dependencies)) {
      if (
        !lockfileDependencies.has(alias) && dep.startsWith('link:') &&
        // If the linked dependency was removed from package.json
        // then it is removed from pnpm-lock.yaml as well
        !(lockfileSpecs.has(alias) && !allDeps.has(alias))
      ) {
        lockfileDependencies.set(alias, dep)
      }
    }
  }

  const updatedImporter: ProjectSnapshot = {
    specifiers,
  }
  const prunnedLockfile: Lockfile = {
    importers: {
      ...lockfile.importers,
      [importerId]: updatedImporter,
    },
    lockfileVersion: lockfile.lockfileVersion || LOCKFILE_VERSION,
    packages: lockfile.packages,
  }
  if (!isEmpty(packages)) {
    prunnedLockfile.packages = packages
  }
  if (!isEmpty(lockfileDependencies)) {
    updatedImporter.dependencies = lockfileDependencies
  }
  if (!isEmpty(lockfileOptionalDependencies)) {
    updatedImporter.optionalDependencies = lockfileOptionalDependencies
  }
  if (!isEmpty(lockfileDevDependencies)) {
    updatedImporter.devDependencies = lockfileDevDependencies
  }
  return pruneSharedLockfile(prunnedLockfile, opts)
}

function copyPackageSnapshots (
  originalPackages: PackageSnapshots,
  opts: {
    devDepPaths: string[]
    optionalDepPaths: string[]
    prodDepPaths: string[]
    warn: (msg: string) => void
  }
): PackageSnapshots {
  const copiedSnapshots: PackageSnapshots = new Map()
  const ctx = {
    copiedSnapshots,
    nonOptional: new Set<string>(),
    notProdOnly: new Set<string>(),
    originalPackages,
    walked: new Set<string>(),
    warn: opts.warn,
  }

  copyDependencySubGraph(ctx, opts.devDepPaths, {
    dev: true,
    optional: false,
  })
  copyDependencySubGraph(ctx, opts.optionalDepPaths, {
    dev: false,
    optional: true,
  })
  copyDependencySubGraph(ctx, opts.prodDepPaths, {
    dev: false,
    optional: false,
  })

  return copiedSnapshots
}

function resolvedDepsToDepPaths (deps: ResolvedDependencies) {
  return Object.entries(deps)
    .map(([alias, ref]) => refToRelative(ref, alias))
    .filter((depPath) => depPath !== null) as string[]
}

function copyDependencySubGraph (
  ctx: {
    copiedSnapshots: PackageSnapshots
    nonOptional: Set<string>
    notProdOnly: Set<string>
    originalPackages: PackageSnapshots
    walked: Set<string>
    warn: (msg: string) => void
  },
  depPaths: string[],
  opts: {
    dev: boolean
    optional: boolean
  }
) {
  for (const depPath of depPaths) {
    const key = `${depPath}:${opts.optional.toString()}:${opts.dev.toString()}`
    if (ctx.walked.has(key)) continue
    ctx.walked.add(key)
    if (!ctx.originalPackages.has(depPath)) {
      // local dependencies don't need to be resolved in pnpm-lock.yaml
      // except local tarball dependencies
      if (depPath.startsWith('link:') || depPath.startsWith('file:') && !depPath.endsWith('.tar.gz')) continue

      ctx.warn(`Cannot find resolution of ${depPath} in lockfile`)
      continue
    }
    const depLockfile = ctx.originalPackages.get(depPath)!
    ctx.copiedSnapshots.set(depPath, depLockfile)
    if (opts.optional && !ctx.nonOptional.has(depPath)) {
      depLockfile.optional = true
    } else {
      ctx.nonOptional.add(depPath)
      delete depLockfile.optional
    }
    if (opts.dev) {
      ctx.notProdOnly.add(depPath)
      depLockfile.dev = true
    } else if (depLockfile.dev === true) { // keeping if dev is explicitly false
      delete depLockfile.dev
    } else if (depLockfile.dev === undefined && !ctx.notProdOnly.has(depPath)) {
      depLockfile.dev = false
    }
    const newDependencies = resolvedDepsToDepPaths(depLockfile.dependencies ?? new Map())
    copyDependencySubGraph(ctx, newDependencies, opts)
    const newOptionalDependencies = resolvedDepsToDepPaths(depLockfile.optionalDependencies ?? new Map())
    copyDependencySubGraph(ctx, newOptionalDependencies, {
      dev: opts.dev,
      optional: true,
    })
  }
}
