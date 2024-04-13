import { getSuitableLibPackagesNames, spawn } from './utils'

export const installLatest = async ({ cwd }: { cwd: string }) => {
  const { suitableProdPackagesNames, suitableDevPackagesNames } = await getSuitableLibPackagesNames({ cwd })
  if (!suitableProdPackagesNames.length && !suitableDevPackagesNames.length) {
    console.info('Nothing to install')
    return
  }
  if (suitableProdPackagesNames.length) {
    await spawn({ cwd, command: `pnpm install ${suitableProdPackagesNames.map((p) => `${p}@latest`).join(' ')}` })
  }
  if (suitableDevPackagesNames.length) {
    await spawn({ cwd, command: `pnpm install -D ${suitableDevPackagesNames.map((p) => `${p}@latest`).join(' ')}` })
  }
}
