import { getOrderedRootLibPackagesData } from '@/lib/utils.js'
import { getPackageJson, log, spawn } from 'svag-cli-utils'

export const lint = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: 'pnpm lint' })
}

export const lintFix = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: 'pnpm lint --fix' })
}

export const isLintable = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJson({ cwd })
  return { lintable: !!packageJsonData.scripts?.lint }
}

export const lintIfPossible = async ({ cwd }: { cwd: string }) => {
  const { lintable } = await isLintable({ cwd })
  if (lintable) {
    await lint({ cwd })
    return { linted: true }
  }
  return { linted: false }
}

export const lintRecursive = async ({ cwd }: { cwd: string }) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { lintable } = await isLintable({ cwd: rootLibPackagePath })
    if (lintable) {
      log.green(`Linting ${rootLibPackagePath}`)
      await lint({ cwd: rootLibPackagePath })
      log.toMemory.black(`Linted ${rootLibPackagePath}`)
    }
  }
}

export const lintFixRecursive = async ({ cwd }: { cwd: string }) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { lintable } = await isLintable({ cwd: rootLibPackagePath })
    if (lintable) {
      log.green(`Linting and fixing ${rootLibPackagePath}`)
      await lintFix({ cwd: rootLibPackagePath })
      log.toMemory.black(`Linted and fixed ${rootLibPackagePath}`)
    }
  }
}
