import { getSuitableLibPackages } from '@/lib/utils.js'
import { getAllPackageJsonPaths, log, spawn } from 'svag-cli-utils'

export const update = async ({ cwd }: { cwd: string }) => {
  const { allPackageJsonsPathsAndDirs } = await getAllPackageJsonPaths({ cwd })
  for (const { packageJsonDir } of allPackageJsonsPathsAndDirs) {
    await updateCurrent({ cwd: packageJsonDir })
  }
}

export const updateCurrent = async ({ cwd }: { cwd: string }) => {
  const { suitableProdPackagesNames, suitableDevPackagesNames } = await getSuitableLibPackages({ cwd })
  if (!suitableProdPackagesNames.length && !suitableDevPackagesNames.length) {
    log.green(`${cwd}: nothing to install`)
    return
  }
  if (suitableProdPackagesNames.length) {
    await spawn({
      cwd,
      command: `pnpm install --color ${suitableProdPackagesNames.map((p) => `${p}@latest`).join(' ')}`,
    })
  }
  if (suitableDevPackagesNames.length) {
    await spawn({
      cwd,
      command: `pnpm install --color -D ${suitableDevPackagesNames.map((p) => `${p}@latest`).join(' ')}`,
    })
  }
}
