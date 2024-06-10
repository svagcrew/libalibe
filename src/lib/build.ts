import { getOrderedRootLibPackagesData } from '@/lib/utils.js'
import { getPackageJson, log, spawn } from 'svag-cli-utils'

export const build = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: 'pnpm build' })
}

export const isBuildable = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJson({ cwd })
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
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { buildable } = await isBuildable({ cwd: rootLibPackagePath })
    if (buildable) {
      log.green(`Building ${rootLibPackagePath}`)
      await build({ cwd: rootLibPackagePath })
      log.toMemory.black(`Built ${rootLibPackagePath}`)
    }
  }
}
