import { log, spawn } from 'svag-cli-utils'
import { getOrderedLibPackagesData, getSuitableLibPackages } from '@/lib/utils'

export const link = async ({ cwd }: { cwd: string }) => {
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  if (suitablePackagesNames.length) {
    // wait 100ms for safety
    await new Promise((resolve) => setTimeout(resolve, 100))
    await spawn({ cwd, command: `pnpm link -g ${suitablePackagesNames.join(' ')}` })
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
