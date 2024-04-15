import { findAllConfigsPaths } from './config'
import { spawn } from './exec'
import { log } from './utils'

export const edit = async ({ cwd }: { cwd: string }) => {
  const { configPaths } = await findAllConfigsPaths({ dirPath: cwd })
  if (!configPaths.length) {
    log.red('No config files found')
    return
  }
  for (const configPath of configPaths) {
    await spawn({ cwd, command: `code ${configPath}` })
  }
}
