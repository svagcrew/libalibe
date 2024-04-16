import { spawn } from './exec'
import { getOrderedLibPackagesData, getPackageJsonData, log } from './utils'

export const typecheck = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: 'pnpm types' })
}

export const isTypecheckable = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
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
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { libPackagePath } of libPackagesData) {
    const { typecheckable } = await isTypecheckable({ cwd: libPackagePath })
    if (typecheckable) {
      log.green(`Typechecking ${libPackagePath}`)
      await typecheck({ cwd: libPackagePath })
    }
  }
}