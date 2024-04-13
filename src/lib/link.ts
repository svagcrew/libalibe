import { getSuitableLibPackagesNames, spawn } from './utils'

export const link = async ({ cwd }: { cwd: string }) => {
  const { suitablePackagesNames } = await getSuitableLibPackagesNames({ cwd })
  if (suitablePackagesNames.length) {
    await spawn({ cwd, command: `pnpm link -g ${suitablePackagesNames.join(' ')}` })
  } else {
    console.info('Nothing to link')
  }
}
