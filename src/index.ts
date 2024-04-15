#!/usr/bin/env ts-node

import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'
import { edit } from './lib/edit'
import { installLatest } from './lib/install'
import { link, linkRecursive, unlink } from './lib/link'
import { bumpPushPublish, commitBumpPushPublish, commitBumpPushPublishRecursive } from './lib/publish'
import { spawn } from './lib/exec'

void (async () => {
  try {
    const argv = await yargs(hideBin(process.argv)).argv
    const knownCommands = ['link', 'linkr', 'unlink', 'edit', 'bpp', 'cbpp', 'cbppr', 'il', 'ill', 'ping']
    const { command, args } = (() => {
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
      case 'linkr':
        await linkRecursive({ cwd })
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
      case 'ping':
        await spawn({ cwd, command: 'echo pong' })
        break
      default:
        console.info('Unknown command:', command)
        break
    }
  } catch (error) {
    console.error(error)
  }
})()
