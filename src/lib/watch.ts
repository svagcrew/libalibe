import { getOrderedRootLibPackagesData, type RootLibPackageData } from '@/lib/utils.js'
import { getPackageJson, spawn } from 'svag-cli-utils'
import { get__dirname } from 'svag-esm'
const __dirname = get__dirname(import.meta)

export const isWatchable = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJson({ cwd })
  return { watchable: !!packageJsonData.scripts?.watch }
}

export const watchRecursiveConcurrently = async ({ cwd }: { cwd: string }) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }

  const watchableLibPackagesData: RootLibPackageData[] = []
  for (const rootLibPackageData of rootLibPackagesData) {
    const { watchable } = await isWatchable({ cwd: rootLibPackageData.rootLibPackagePath })
    if (watchable) {
      watchableLibPackagesData.push(rootLibPackageData)
    }
  }
  if (!watchableLibPackagesData.length) {
    throw new Error('No watchable packages found')
  }

  const commands = watchableLibPackagesData
    .map(({ rootLibPackagePath }) => `"cd ${rootLibPackagePath} && pnpm watch"`)
    .join(' ')
  const names = watchableLibPackagesData.map(({ rootLibPackageName }) => rootLibPackageName).join(',')
  await spawn({
    cwd: __dirname,
    command: `pnpm concurrently --kill-others-on-fail --names ${names} ${commands}`,
  })
}
