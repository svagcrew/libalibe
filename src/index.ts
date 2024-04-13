#!/usr/bin/env ts-node

import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'
import { getConfig, getPackageJsonData } from './lib/config'
import { link } from './lib/link'
import { bumpPushPublish, commitBumpPushPublish } from './lib/publish'

void (async () => {
  try {
    const argv = await yargs(hideBin(process.argv)).argv
    const knownCommands = ['link', 'bpp', 'cbpp']
    const { command, args } = (() => {
      if (!argv._.length) return { command: 'link', args: [] }
      if (knownCommands.includes(argv._[0].toString())) {
        return { command: argv._[0].toString(), args: argv._.slice(1) }
      }
      throw new Error('Unknown command')
    })()

    const cwd = process.cwd()
    const { config } = await getConfig({ dirPath: cwd })
    const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })

    switch (command) {
      case 'link':
        await link({ cwd, config, packageJsonData })
        break
      case 'bpp':
        await bumpPushPublish({
          cwd,
          bump: args[0] === 'major' ? 'major' : args[0] === 'minor' ? 'minor' : args[0] === 'patch' ? 'patch' : 'patch',
        })
        break
      case 'cbpp':
        await commitBumpPushPublish({
          cwd,
          message: args[0] ? args[0].toString() : 'Small fix',
        })
        break
      default:
        console.info('Unknown command:', command, packageJsonData)
        break
    }
  } catch (error) {
    console.error(error)
  }
})()
