#!/usr/bin/env ts-node

import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'
import { buildRecursive } from './lib/build'
import { edit } from './lib/edit'
import { spawn } from './lib/exec'
import { installLatest } from './lib/install'
import { link, linkRecursive, unlink } from './lib/link'
import { lintFixRecursive, lintRecursive } from './lib/lint'
import {
  buildBumpPushPublish,
  commitBuildBumpPushPublish,
  updateCommitBuildBumpPushPublish,
  updateCommitBuildBumpPushPublishRecursive,
  updateCommitSmallFixBuildBumpPushPublishRecursive,
} from './lib/publish'
import { pullOrCloneRecursive } from './lib/pull'
import { typecheckRecursive } from './lib/types'
import { log } from './lib/utils'

void (async () => {
  try {
    const argv = await yargs(hideBin(process.argv)).argv
    const knownCommands = [
      'link',
      'linkr',
      'unlink',
      'buildr',
      'typesr',
      'lintr',
      'lintfixr',
      'edit',
      'bbpp',
      'cbbpp',
      'ucbbpp',
      'ucbbppr',
      'bam',
      'ucsfbbppr',
      'boom',
      'il',
      'ill',
      'pocr',
      'h',
      'ping',
    ]
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
      case 'buildr':
        await buildRecursive({ cwd })
        break
      case 'typesr':
        await typecheckRecursive({ cwd })
        break
      case 'lintr':
        await lintRecursive({ cwd })
        break
      case 'lintfixr':
        await lintFixRecursive({ cwd })
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
      case 'bbpp':
        await buildBumpPushPublish({
          cwd,
          bump: args[0] === 'major' ? 'major' : args[0] === 'minor' ? 'minor' : args[0] === 'patch' ? 'patch' : 'patch',
        })
        break
      case 'cbbpp':
        await commitBuildBumpPushPublish({
          cwd,
          message: args[0] ? args[0].toString() : 'Small fix',
        })
        break
      case 'ucbbpp':
        await updateCommitBuildBumpPushPublish({ cwd })
        break
      case 'ucbbppr':
        await updateCommitBuildBumpPushPublishRecursive({ cwd })
        break
      case 'bam':
        await updateCommitBuildBumpPushPublishRecursive({ cwd })
        break
      case 'ucsfbbppr':
        await updateCommitSmallFixBuildBumpPushPublishRecursive({ cwd })
        break
      case 'boom':
        await updateCommitSmallFixBuildBumpPushPublishRecursive({ cwd })
        break
      case 'pocr':
        await pullOrCloneRecursive({ cwd })
        break
      case 'h':
        log.black(`Commands:
link — link packages
linkr — link packages recursive
unlink — unlink packages
buildr — build packages recursive
typesr — typecheck packages recursive
lintr — lint packages recursive
edit — edit package.json
il — install latest packages
ill — install latest packages and link
bbpp — build, bump, push, publish
cbbpp — commit, build, bump, push, publish
ucbbpp — update, commit, build, bump, push, publish
ucbbppr — update, commit, build, bump, push, publish, recursive
bam — same as "cbbppr"
ucsfbbppr — commit small fix, build, bump, push, publish, recursive
boom — same as "csfbbppr"
pocr — pull or clone recursive
h — show help
ping — pong`)
        break
      case 'ping':
        await spawn({ cwd, command: 'echo pong' })
        break
      default:
        log.red('Unknown command:', command)
        break
    }
    if (log.isMemoryNotEmpty()) {
      log.black('=====Result=====')
      log.fromMemory()
    }
  } catch (error) {
    log.error(error)
  }
})()
