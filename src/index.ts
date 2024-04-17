import { buildRecursive } from '@/lib/build'
import { edit } from '@/lib/edit'
import { update } from '@/lib/install'
import { link, linkGlobal, linkGlobalRecursive, linkRecursive, unlink } from '@/lib/link'
import { lintFixRecursive, lintRecursive } from '@/lib/lint'
import {
  buildBumpPushPublish,
  commitBuildBumpPushPublish,
  prepareUpdateLinkCommitBuildBumpPushPublishRecursive,
  prepareUpdateLinkCommitBuildBumpPushPublishRecursiveFoxy,
  updateLinkCommitBuildBumpPushPublishRecursiveFoxy,
  updateLinkCommitSmallFixBuildBumpPushPublishRecursiveFoxy,
  updateLinkCommitBuildBumpPushPublish,
  updateLinkCommitBuildBumpPushPublishRecursive,
  updateLinkCommitSmallFixBuildBumpPushPublishRecursive,
} from '@/lib/publish'
import { pullOrCloneRecursive } from '@/lib/pull'
import { typecheckRecursive } from '@/lib/types'
import { watchRecursiveConcurrently } from '@/lib/watch'
import dedent from 'dedent'
import { defineCliApp, log, spawn } from 'svag-cli-utils'

defineCliApp(async ({ args, command, cwd, flags, argr }) => {
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
    case 'u':
      await update({ cwd })
      break
    case 'ul':
      await update({ cwd })
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
        message: args[0] || 'Small fix',
      })
      break
    case 'hop':
      await updateLinkCommitBuildBumpPushPublish({ cwd })
      break
    case 'bam':
      await updateLinkCommitBuildBumpPushPublishRecursive({
        cwd,
        include: typeof flags.i === 'string' ? flags.i.split(',') : undefined,
        forceAccuracy: !!flags.a || !!flags.forceAccuracy,
      })
      break
    case 'boom':
      await updateLinkCommitSmallFixBuildBumpPushPublishRecursive({
        cwd,
        include: typeof flags.i === 'string' ? flags.i.split(',') : undefined,
        forceAccuracy: !!flags.a || !!flags.forceAccuracy,
      })
      break
    case 'pbam':
    case 'pboom':
      await prepareUpdateLinkCommitBuildBumpPushPublishRecursive({
        cwd,
        include: typeof flags.i === 'string' ? flags.i.split(',') : undefined,
        forceAccuracy: !!flags.a || !!flags.forceAccuracy,
      })
      break
    case 'x':
    case 'badaboom':
      await updateLinkCommitBuildBumpPushPublishRecursiveFoxy({
        cwd,
        include: typeof flags.i === 'string' ? flags.i.split(',') : undefined,
        forceAccuracy: !!flags.a || !!flags.forceAccuracy,
      })
      break
    case 'xx':
    case 'bidibadaboom':
      await updateLinkCommitSmallFixBuildBumpPushPublishRecursiveFoxy({
        cwd,
        include: typeof flags.i === 'string' ? flags.i.split(',') : undefined,
        forceAccuracy: !!flags.a || !!flags.forceAccuracy,
      })
      break
    case 'px':
    case 'pxx':
    case 'pbadaboom':
    case 'pbidibadaboom':
      await prepareUpdateLinkCommitBuildBumpPushPublishRecursiveFoxy({
        cwd,
        include: typeof flags.i === 'string' ? flags.i.split(',') : undefined,
        forceAccuracy: !!flags.a || !!flags.forceAccuracy,
      })
      break
    case 'pocr':
      await pullOrCloneRecursive({ cwd })
      break
    case 'i':
      await spawn({
        cwd,
        command: `pnpm install --color ${argr.join(' ')}`,
      })
      await link({ cwd })
      break
    case 'r':
      await spawn({
        cwd,
        command: `pnpm remove --color ${argr.join(' ')}`,
      })
      await link({ cwd })
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
        u — update libalibe packages
        ul — update libalibe packages and link
        bbpp — build, bump, push, publish
        cbbpp — commit, build, bump, push, publish
        hop — update, commit, build, bump, push, publish
        bam — update, commit, build, bump, push, publish, recursive
        boom — update, commit small fix, build, bump, push, publish, recursive
        pbam | pboom — just log bam | boom, not do it
        pboom — just log boom, not do it
        badaboom | x — update, commit, build, bump, push, publish, recursive-foxy
        bidibadaboom | xx — update, commit small fix, build, bump, push, publish, recursive-foxy
        pbadaboom | pbidibadaboom | px | pxx — just log badaboom, not do it
        pocr — pull or clone recursive
        i — pnpm install ... && lili link
        r — pnpm remove ... && lili link
        ping — pong
        h — show help
        `)
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
