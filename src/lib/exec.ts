import { getOrderedLibPackagesData } from '@/lib/utils'
import { log, spawn } from 'svag-cli-utils'

export const execCommandRecursive = async ({ cwd, command }: { cwd: string; command: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    log.black('No packages found at all')
    return
  }
  for (const { libPackagePath } of libPackagesData) {
    log.green(`Executing in ${libPackagePath}`)
    await spawn({ cwd: libPackagePath, command })
    log.toMemory.black(`Ran ${libPackagePath}`)
  }
}
