#!/usr/bin/env ts-node

import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'
import { edit } from './lib/edit'
import { installLatest } from './lib/install'
import { link, unlink } from './lib/link'
import { bumpPushPublish, commitBumpPushPublish, commitBumpPushPublishRecursive } from './lib/publish'

void (async () => {
  try {
    const argv = await yargs(hideBin(process.argv)).argv
    const knownCommands = ['link', 'unlink', 'edit', 'bpp', 'cbpp', 'cbppr', 'il', 'ill']
    const { command, args } = (() => {
      if (!argv._.length) return { command: 'link', args: [] }
      if (knownCommands.includes(argv._[0].toString())) {
        return { command: argv._[0].toString(), args: argv._.slice(1) }
      }
      throw new Error('Unknown command')
    })()

    const cwd = process.cwd()

    switch (command) {
      case 'link':
        await link({ cwd })
        break
      case 'unlink':
        await unlink({ cwd })
        break
      case 'edit':
        await edit({ cwd })
        break
      case 'il':
        await installLatest({ cwd })
        break
      case 'ill':
        await installLatest({ cwd })
        await link({ cwd })
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
      case 'cbppr':
        await commitBumpPushPublishRecursive({ cwd })
        break
      default:
        console.info('Unknown command:', command)
        break
    }
  } catch (error) {
    console.error(error)
  }
})()
