import { type Lockfile, type PackageSnapshot, type PackageSnapshots } from '@pnpm/lockfile-types'
import comverToSemver from 'comver-to-semver'
import semver from 'semver'

export function mergeLockfileChanges (ours: Lockfile, theirs: Lockfile) {
  const newLockfile: Lockfile = {
    importers: new Map(),
    lockfileVersion: semver.gt(comverToSemver(theirs.lockfileVersion.toString()), comverToSemver(ours.lockfileVersion.toString()))
      ? theirs.lockfileVersion
      : ours.lockfileVersion,
  }

  for (const importerId of Array.from(new Set([...ours.importers.keys(), ...theirs.importers.keys()]))) {
    newLockfile.importers.set(importerId, {
      specifiers: new Map(),
    })
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies'] as const) {
      newLockfile.importers.get(importerId)![key] = mergeDict(
        ours.importers.get(importerId)?.[key] ?? new Map(),
        theirs.importers.get(importerId)?.[key] ?? new Map(),
        mergeVersions
      )
      if (Object.keys(newLockfile.importers.get(importerId)![key] ?? {}).length === 0) {
        newLockfile.importers.get(importerId)![key] = undefined;
      }
    }
    newLockfile.importers.get(importerId)!.specifiers = mergeDict(
      ours.importers.get(importerId)?.specifiers ?? new Map(),
      theirs.importers.get(importerId)?.specifiers ?? new Map(),
      takeChangedValue
    )
  }

  const packages: PackageSnapshots = new Map()
  for (const depPath of Array.from(new Set([...ours.packages?.keys() || [], ...theirs.packages?.keys() || []]))) {
    const ourPkg = ours.packages?.get(depPath)
    const theirPkg = theirs.packages?.get(depPath)
    const pkg = {
      ...ourPkg,
      ...theirPkg,
    }
    for (const key of ['dependencies', 'optionalDependencies'] as const) {
      pkg[key] = mergeDict(
        ourPkg?.[key] ?? new Map(),
        theirPkg?.[key] ?? new Map(),
        mergeVersions
      )
      if (!pkg[key]?.size) {
        pkg[key] = undefined
      }
    }
    packages.set(depPath, pkg as PackageSnapshot)
  }
  newLockfile.packages = packages

  return newLockfile
}

type ValueMerger<T> = (ourValue: T, theirValue: T) => T

function mergeDict<T> (
  ourDict: Map<string, T>,
  theirDict: Map<string, T>,
  valueMerger: ValueMerger<T>
) {
  const newDict: Map<string, T> = new Map()
  const mergeValueByKey = (key: string) => {
    const changedValue = valueMerger(
      ourDict.get(key)!,
      theirDict.get(key)!
    )
    if (changedValue) {
      newDict.set(key, changedValue)
    }
  }
  for (const key of ourDict.keys()) {
    mergeValueByKey(key)
  }
  for (const key of theirDict.keys()) {
    mergeValueByKey(key)
  }
  return newDict
}

function takeChangedValue<T> (ourValue: T, theirValue: T): T {
  if (ourValue === theirValue || theirValue == null) return ourValue
  return theirValue
}

function mergeVersions (ourValue: string, theirValue: string) {
  if (ourValue === theirValue || !theirValue) return ourValue
  if (!ourValue) return theirValue
  const [ourVersion] = ourValue.split('_')
  const [theirVersion] = theirValue.split('_')
  if (semver.gt(ourVersion, theirVersion)) {
    return ourValue
  }
  return theirValue
}
