import { spawn } from './exec'
import { getSuitableLibPackages } from './utils'

export const link = async ({ cwd }: { cwd: string }) => {
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  if (suitablePackagesNames.length) {
    await spawn({ cwd, command: `pnpm link -g ${suitablePackagesNames.join(' ')}` })
  } else {
    console.info('Nothing to link')
  }
}

export const unlink = async ({ cwd }: { cwd: string }) => {
  const { suitableProdPackagesNames, suitableDevPackagesNames } = await getSuitableLibPackages({ cwd })
  if (!suitableProdPackagesNames.length && !suitableDevPackagesNames.length) {
    console.info('Nothing to unlink')
    return
  }
  if (suitableProdPackagesNames.length) {
    await spawn({ cwd, command: `pnpm install ${suitableProdPackagesNames.join(' ')}` })
  }
  if (suitableDevPackagesNames.length) {
    await spawn({ cwd, command: `pnpm install -D ${suitableDevPackagesNames.join(' ')}` })
  }
}
