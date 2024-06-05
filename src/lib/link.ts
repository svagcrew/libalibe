import { getOrderedLibPackagesData, getSuitableLibPackages } from '@/lib/utils.js'
import { getAllPackageJsonPaths, log, spawn } from 'svag-cli-utils'

export const link = async ({ cwd }: { cwd: string }) => {
  const { allPackageJsonsPathsAndDirs } = await getAllPackageJsonPaths({ cwd })
  for (const { packageJsonDir } of allPackageJsonsPathsAndDirs) {
    await linkCurrent({ cwd: packageJsonDir })
  }
}

export const linkCurrent = async ({ cwd }: { cwd: string }) => {
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  if (suitablePackagesNames.length) {
    // wait 300ms for safety
    await new Promise((resolve) => setTimeout(resolve, 300))
    // for (const suitablePackageName of suitablePackagesNames) {
    //   await spawn({ cwd, command: `pnpm link --color -g ${suitablePackageName}` })
    // }
    await spawn({ cwd, command: `pnpm link --color -g ${suitablePackagesNames.join(' ')}` })
  } else {
    log.green(`${cwd}: nothing to link`)
  }
}

export const linkRecursive = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { libPackagePath } of libPackagesData) {
    await link({ cwd: libPackagePath })
  }
}

export const linkGlobal = async ({ cwd }: { cwd: string }) => {
  await spawn({ cwd, command: `pnpm link -g` })
}

export const linkGlobalRecursive = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  for (const { libPackagePath } of libPackagesData) {
    await linkGlobal({ cwd: libPackagePath })
  }
}

export const unlink = async ({ cwd }: { cwd: string }) => {
  const { suitableProdPackagesNames, suitableDevPackagesNames } = await getSuitableLibPackages({ cwd })
  if (!suitableProdPackagesNames.length && !suitableDevPackagesNames.length) {
    log.green(`${cwd}: nothing to unlink`)
    return
  }
  if (suitableProdPackagesNames.length) {
    await spawn({ cwd, command: `pnpm install ${suitableProdPackagesNames.join(' ')}` })
  }
  if (suitableDevPackagesNames.length) {
    await spawn({ cwd, command: `pnpm install -D ${suitableDevPackagesNames.join(' ')}` })
  }
}
