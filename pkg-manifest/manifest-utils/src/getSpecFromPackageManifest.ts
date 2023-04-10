import { type ProjectManifest, type DependenciesOrPeersField } from '@pnpm/types'

export function getSpecFromPackageManifest (
  manifest: Pick<ProjectManifest, DependenciesOrPeersField>,
  depName: string
) {
  return manifest.optionalDependencies?.has(depName) ??
    manifest.dependencies?.has(depName) ??
    manifest.devDependencies?.has(depName) ??
    manifest.peerDependencies?.has(depName) ??
    ''
}
