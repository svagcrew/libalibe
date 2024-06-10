import { isRunableCommand } from '@/lib/run.js'
import { getOrderedRootLibPackagesData } from '@/lib/utils.js'
import { log, spawn } from 'svag-cli-utils'

export const testIt = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: 'pnpm test' })
}

export const isTestable = async ({ cwd }: { cwd: string }) => {
  const { runable } = await isRunableCommand({ cwd, command: 'test' })
  return { testable: runable }
}

export const testItIfPossible = async ({ cwd }: { cwd: string }) => {
  const { testable } = await isTestable({ cwd })
  if (testable) {
    await testIt({ cwd })
    return { tested: true }
  }
  return { tested: false }
}

export const testItRecursive = async ({ cwd }: { cwd: string }) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { testable } = await isTestable({ cwd: rootLibPackagePath })
    if (testable) {
      log.green(`Testing ${rootLibPackagePath}`)
      await testIt({ cwd: rootLibPackagePath })
      log.toMemory.black(`Tested ${rootLibPackagePath}`)
    }
  }
}
