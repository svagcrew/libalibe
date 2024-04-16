import { spawn } from './exec'
import { getOrderedLibPackagesData, getSuitableLibPackages, log } from './utils'

export const link = async ({ cwd }: { cwd: string }) => {
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  if (suitablePackagesNames.length) {
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
