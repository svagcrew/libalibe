import { spawn } from './exec'
import { getOrderedLibPackagesData, getPackageJsonData, LibPackageData } from './utils'

export const isWatchable = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  return { watchable: !!packageJsonData.scripts?.watch }
}

export const watchRecursiveConcurrently = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  const watchableLibPackagesData: LibPackageData[] = []
  for (const libPackageData of libPackagesData) {
    const { watchable } = await isWatchable({ cwd: libPackageData.libPackagePath })
    if (watchable) {
      watchableLibPackagesData.push(libPackageData)
    }
  }
  if (!watchableLibPackagesData.length) {
    throw new Error('No watchable packages found')
  }
  const commands = watchableLibPackagesData
    .map(({ libPackagePath }) => `"cd ${libPackagePath} && pnpm watch"`)
    .join(' ')
  const names = watchableLibPackagesData.map(({ libPackageName }) => libPackageName).join(',')
  await spawn({
    cwd: __dirname,
    command: `pnpm concurrently --kill-others-on-fail --names ${names} ${commands}`,
  })
}
