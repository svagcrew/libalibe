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
  const { libPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { libPackagePath } of libPackagesData) {
    const { testable } = await isTestable({ cwd: libPackagePath })
    if (testable) {
      log.green(`Testing ${libPackagePath}`)
      await testIt({ cwd: libPackagePath })
      log.toMemory.black(`Tested ${libPackagePath}`)
    }
  }
}
