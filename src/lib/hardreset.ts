/* eslint-disable @typescript-eslint/no-unused-vars */
import { getConfig } from '@/lib/config.js'
import { getOrderedRootLibPackagesData } from '@/lib/utils.js'
import path from 'path'
import { log, spawn } from 'svag-cli-utils'

export const hardreset = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ cwd })
  const names = Object.keys(config.items)
  const baseDirName = path.basename(cwd)
  const isOneOfLibalibe = names.find((name) => name === baseDirName)
  if (!isOneOfLibalibe) {
    throw new Error('Not a libalibe package')
  }
  await spawn({ cwd, command: 'rm -rf ./{*,.[!.]*,..?*}' })
  await spawn({ cwd, command: `git clone git@github.com:svagcrew/${baseDirName}.git .` })
}

export const hardresetRecursive = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ cwd })
  const namesAndDirs = Object.entries(config.items)
  if (!namesAndDirs.length) {
    log.black('No packages found at all')
    return
  }
  for (const [name, dirPath] of namesAndDirs) {
    log.black(`Executing in ${dirPath}`)
    await hardreset({ cwd: dirPath })
  }
  log.green('Done')
}
