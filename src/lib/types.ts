import { getOrderedRootLibPackagesData } from '@/lib/utils.js'
import { getPackageJson, log, spawn } from 'svag-cli-utils'

export const typecheck = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: 'pnpm types' })
}

export const isTypecheckable = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJson({ cwd })
  return { typecheckable: !!packageJsonData.scripts?.types }
}

export const typecheckIfPossible = async ({ cwd }: { cwd: string }) => {
  const { typecheckable } = await isTypecheckable({ cwd })
  if (typecheckable) {
    await typecheck({ cwd })
    return { typechecked: true }
  }
  return { typechecked: false }
}

export const typecheckRecursive = async ({ cwd }: { cwd: string }) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { typecheckable } = await isTypecheckable({ cwd: rootLibPackagePath })
    if (typecheckable) {
      log.green(`Typechecking ${rootLibPackagePath}`)
      await typecheck({ cwd: rootLibPackagePath })
      log.toMemory.black(`Typechecked ${rootLibPackagePath}`)
    }
  }
}
