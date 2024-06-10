import { getOrderedRootLibPackagesData } from '@/lib/utils.js'
import { log, spawn } from 'svag-cli-utils'

export const execCommandRecursive = async ({ cwd, command }: { cwd: string; command: string }) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    log.black('No packages found at all')
    return
  }
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    log.green(`Executing in ${rootLibPackagePath}`)
    await spawn({ cwd: rootLibPackagePath, command })
    log.toMemory.black(`Ran ${rootLibPackagePath}`)
  }
}
