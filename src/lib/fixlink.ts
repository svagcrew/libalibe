import { getPublicableLibPackagesPaths, getSuitableLibPackages } from '@/lib/utils.js'
import { exec, getAllPackageJsonPaths, getPackageJson, log, spawn } from 'svag-cli-utils'

export const fixLinkRecursive = async ({ cwd }: { cwd: string }) => {
  const { allPackageJsonsPathsAndDirs } = await getAllPackageJsonPaths({ cwd })
  for (const { packageJsonDir } of allPackageJsonsPathsAndDirs) {
    await fixLink({ cwd: packageJsonDir })
  }
}

const getPeerLibPackagesNames = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJson({ cwd })
  const peerDepsNames = Object.keys(packageJsonData.peerDependencies || {})
  return {
    peerDepsNames,
  }
}

const getPackageNodeModulesPathByName = async ({ cwd, packageName }: { cwd: string; packageName: string }) => {
  const resultDevDependencies = await exec({
    cwd,
    command: `pnpm list ${packageName} --json | jq -r '.[0].devDependencies["${packageName}"].path'`,
  })
  const resultProdDependencies = await exec({
    cwd,
    command: `pnpm list ${packageName} --json | jq -r '.[0].dependencies["${packageName}"].path'`,
  })
  const result = !resultDevDependencies.startsWith('null')
    ? resultDevDependencies.replace(/\n$/, '')
    : !resultProdDependencies.startsWith('null')
      ? resultProdDependencies.replace(/\n$/, '')
      : null
  return {
    packageNodeModulesPath: result,
  }
}

export const fixLink = async ({ cwd }: { cwd: string }) => {
  const { packageJsonDir: projectPath } = await getPackageJson({ cwd })
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  const { libPackagesPaths } = await getPublicableLibPackagesPaths({ cwd, libPackagesNames: suitablePackagesNames })
  for (const libPackagePath of libPackagesPaths) {
    const { peerDepsNames } = await getPeerLibPackagesNames({ cwd: libPackagePath })
    for (const peerDepName of peerDepsNames) {
      const { packageNodeModulesPath: libPeerPackageNodeModulesPath } = await getPackageNodeModulesPathByName({
        cwd: libPackagePath,
        packageName: peerDepName,
      })
      const { packageNodeModulesPath: projectPeerPackageNodeModulesPath } = await getPackageNodeModulesPathByName({
        cwd: projectPath,
        packageName: peerDepName,
      })
      if (!libPeerPackageNodeModulesPath || !projectPeerPackageNodeModulesPath) {
        log.info(`No ${peerDepName} found in ${libPackagePath} or ${projectPath}`)
        continue
      }
      await spawn({
        cwd: libPackagePath,
        command: `rm -rf ${libPeerPackageNodeModulesPath} && ln -s ${projectPeerPackageNodeModulesPath} ${libPeerPackageNodeModulesPath}`,
      })
    }
  }
}
