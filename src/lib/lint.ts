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
  const { libPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { libPackagePath } of libPackagesData) {
    const { lintable } = await isLintable({ cwd: libPackagePath })
    if (lintable) {
      log.green(`Linting ${libPackagePath}`)
      await lint({ cwd: libPackagePath })
      log.toMemory.black(`Linted ${libPackagePath}`)
    }
  }
}

export const lintFixRecursive = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { libPackagePath } of libPackagesData) {
    const { lintable } = await isLintable({ cwd: libPackagePath })
    if (lintable) {
      log.green(`Linting and fixing ${libPackagePath}`)
      await lintFix({ cwd: libPackagePath })
      log.toMemory.black(`Linted and fixed ${libPackagePath}`)
    }
  }
}
