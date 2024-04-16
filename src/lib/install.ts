import { spawn } from 'svag-cli-utils'
import { getSuitableLibPackages, log } from './utils'

export const installLatest = async ({ cwd }: { cwd: string }) => {
  const { suitableProdPackagesNames, suitableDevPackagesNames } = await getSuitableLibPackages({ cwd })
  if (!suitableProdPackagesNames.length && !suitableDevPackagesNames.length) {
    log.green(`${cwd}: nothing to install`)
    return
  }
  if (suitableProdPackagesNames.length) {
    await spawn({
      cwd,
      command: `pnpm install ${suitableProdPackagesNames.map((p) => `${p}@latest`).join(' ')}`,
    })
  }
  if (suitableDevPackagesNames.length) {
    await spawn({
      cwd,
      command: `pnpm install -D ${suitableDevPackagesNames.map((p) => `${p}@latest`).join(' ')}`,
    })
  }
}
