import dedent from 'dedent'
import { defineCliApp, log, spawn } from 'svag-cli-utils'
import { buildRecursive } from './lib/build'
import { edit } from './lib/edit'
import { installLatest } from './lib/install'
import { link, linkGlobal, linkGlobalRecursive, linkRecursive, unlink } from './lib/link'
import { lintFixRecursive, lintRecursive } from './lib/lint'
import {
  buildBumpPushPublish,
  commitBuildBumpPushPublish,
  prepareUpdateCommitSmallFixBuildBumpPushPublishRecursive,
  updateCommitBuildBumpPushPublish,
  updateCommitBuildBumpPushPublishRecursive,
  updateCommitSmallFixBuildBumpPushPublishRecursive,
} from './lib/publish'
import { pullOrCloneRecursive } from './lib/pull'
import { typecheckRecursive } from './lib/types'
import { watchRecursiveConcurrently } from './lib/watch'

defineCliApp(async ({ args, command, cwd, flags }) => {
  switch (command) {
    case 'link':
      await link({ cwd })
      break
    case 'linkr':
      await linkRecursive({ cwd })
      break
    case 'linkg':
      await linkGlobal({ cwd })
      break
    case 'linkgr':
      await linkGlobalRecursive({ cwd })
      break
    case 'unlink':
      await unlink({ cwd })
      break
    case 'buildr':
      await buildRecursive({ cwd })
      break
    case 'watchr':
      await watchRecursiveConcurrently({ cwd })
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
    case 'pucsfbbppr':
      await prepareUpdateCommitSmallFixBuildBumpPushPublishRecursive({ cwd })
      break
    case 'pboom':
      await prepareUpdateCommitSmallFixBuildBumpPushPublishRecursive({ cwd })
      break
    case 'pocr':
      await pullOrCloneRecursive({ cwd })
      break
    case 'h':
      log.black(dedent`Commands:
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
      log.black(JSON.stringify({ args, command, cwd, flags }, null, 2))
      await spawn({ cwd, command: 'echo pong' })
      break
    default:
      log.red('Unknown command:', command)
      break
  }
})
