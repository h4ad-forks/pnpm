import { type ProjectManifest, type DependenciesOrPeersField } from '@pnpm/types'

export function getDependencyTypeFromManifest (
  manifest: Pick<ProjectManifest, DependenciesOrPeersField>,
  depName: string
): DependenciesOrPeersField | null {
  if (manifest.optionalDependencies?.has(depName)) return 'optionalDependencies'
  if (manifest.dependencies?.has(depName)) return 'dependencies'
  if (manifest.devDependencies?.has(depName)) return 'devDependencies'
  if (manifest.peerDependencies?.has(depName)) return 'peerDependencies'
  return null
}
