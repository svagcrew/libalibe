import { log, spawn } from 'svag-cli-utils'
import { findAllConfigsPaths } from '@/lib/config'

export const edit = async ({ cwd }: { cwd: string }) => {
  const { configPaths } = await findAllConfigsPaths({ cwd })
  if (!configPaths.length) {
    log.red('No config files found')
    return
  }
  for (const configPath of configPaths) {
    await spawn({ cwd, command: `code ${configPath}` })
  }
}
