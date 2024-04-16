import { spawn } from './exec'
import { getOrderedLibPackagesData, getPackageJsonData, log } from './utils'

export const build = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: 'pnpm build' })
}

export const isBuildable = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  return { buildable: !!packageJsonData.scripts?.build }
}

export const buildIfPossible = async ({ cwd }: { cwd: string }) => {
  const { buildable } = await isBuildable({ cwd })
  if (buildable) {
    await build({ cwd })
    return { built: true }
  }
  return { built: false }
}

export const buildRecursive = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { libPackagePath } of libPackagesData) {
    const { buildable } = await isBuildable({ cwd: libPackagePath })
    if (buildable) {
      log.green(`Building ${libPackagePath}`)
      await build({ cwd: libPackagePath })
    }
  }
}