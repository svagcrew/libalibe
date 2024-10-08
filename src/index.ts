import { buildRecursive } from '@/lib/build.js'
import { addItemToConfig } from '@/lib/config.js'
import { edit } from '@/lib/edit.js'
import { execCommandRecursive } from '@/lib/exec.js'
import { fixLinkRecursive } from '@/lib/fixlink.js'
import { hardreset, hardresetRecursive } from '@/lib/hardreset.js'
import { update } from '@/lib/install.js'
import { link, linkGlobal, linkGlobalRecursive, linkRecursive, unlink } from '@/lib/link.js'
import { lintFixRecursive, lintRecursive } from '@/lib/lint.js'
import {
  buildBumpPushPublish,
  commitBuildBumpPushPublish,
  prepareUpdateLinkCommitBuildBumpPushPublishRecursive,
  prepareUpdateLinkCommitBuildBumpPushPublishRecursiveFoxy,
  updateLinkCommitBuildBumpPushPublish,
  updateLinkCommitBuildBumpPushPublishRecursive,
  updateLinkCommitBuildBumpPushPublishRecursiveFoxy,
  updateLinkCommitSmallFixBuildBumpPushPublish,
  updateLinkCommitSmallFixBuildBumpPushPublishRecursive,
  updateLinkCommitSmallFixBuildBumpPushPublishRecursiveFoxy,
} from '@/lib/publish.js'
import { pullOrCloneRecursive } from '@/lib/pull.js'
import { addRemoteOrigin, createRemoteRepo, switchGithubDefaultBranchToMain } from '@/lib/remote.js'
import { runCommandRecursive } from '@/lib/run.js'
import { testItRecursive } from '@/lib/testcmd.js'
import { typecheckRecursive } from '@/lib/types.js'
import { watchRecursiveConcurrently } from '@/lib/watch.js'
import dedent from 'dedent'
import { defineCliApp, getFlagAsBoolean, getFlagAsString, log, spawn } from 'svag-cli-utils'

defineCliApp(async ({ args, command, cwd, flags, argr }) => {
  switch (command) {
    case 'runr': {
      const [firstArg, ...restArgs] = argr
      await runCommandRecursive({ cwd, command: firstArg, argr: restArgs })
      break
    }
    case 'execr':
      await execCommandRecursive({ cwd, command: argr.join(' ') })
      break
    case 'hardreset':
      await hardreset({ cwd })
      break
    case 'hardresetr':
      await hardresetRecursive({ cwd })
      break
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
    case 'fixlink':
    case 'fl': {
      await fixLinkRecursive({ cwd })
      break
    }
    case 'testr':
      await testItRecursive({ cwd })
      break
    case 'checkr':
      await typecheckRecursive({ cwd })
      await lintFixRecursive({ cwd })
      await testItRecursive({ cwd })
      break
    case 'edit':
      await edit({ cwd })
      break
    case 'u':
      await update({ cwd })
      break
    case 'create-remote':
    case 'cr': {
      const isPrivate = getFlagAsBoolean({ flags, keys: ['private', 'p'], coalesce: false })
      const githubOrganization = getFlagAsString({ flags, keys: ['org', 'o'], coalesce: undefined })
      const githubToken = getFlagAsString({ flags, keys: ['token', 't'], coalesce: undefined })
      const repositoryName = getFlagAsString({ flags, keys: ['name', 'n'], coalesce: undefined })
      await createRemoteRepo({
        cwd,
        repositoryName,
        githubOrganization,
        githubToken,
        isPublic: !isPrivate,
      })
      await addRemoteOrigin({ cwd, githubOrganization, repositoryName })
      break
    }
    case 'github-main': {
      const githubOrganization = getFlagAsString({ flags, keys: ['org', 'o'], coalesce: undefined })
      const repositoryName = getFlagAsString({ flags, keys: ['name', 'n'], coalesce: undefined })
      await switchGithubDefaultBranchToMain({ cwd, githubOrganization, repositoryName })
      break
    }
    case 'github-remove-master': {
      if (1) {
        log.red('Please, no')
      } else {
        try {
          await spawn({
            cwd,
            command: `git push origin --delete master`,
            exitOnFailure: false,
          })
        } catch (error) {
          log.red(error)
        }
      }
      break
    }
    case 'add-to-libalibe-config':
    case 'al': {
      await addItemToConfig({ projectPath: args[0] || cwd })
      break
    }
    case 'add-to-workspace':
    case 'aw': {
      await spawn({
        cwd,
        command: `code --add ${args[0] || cwd}`,
        exitOnFailure: true,
      })
      break
    }
    case 'link-remote-config-workspace':
    case 'init': {
      await link({ cwd })
      await linkGlobal({ cwd })
      await createRemoteRepo({
        cwd,
        isPublic: true,
      })
      await addRemoteOrigin({ cwd })
      await addItemToConfig({ projectPath: cwd })
      await spawn({
        cwd,
        command: `code --add ${args[0] || cwd}`,
        exitOnFailure: true,
      })
      await updateLinkCommitSmallFixBuildBumpPushPublish({ cwd })
      break
    }
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
    case 'xp':
    case 'xxp':
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
        exitOnFailure: true,
      })
      await link({ cwd })
      break
    case 'r':
      await spawn({
        cwd,
        command: `pnpm remove --color ${argr.join(' ')}`,
        exitOnFailure: true,
      })
      await link({ cwd })
      break
    case 'h':
      log.black(dedent`Commands:
        runr — run "pnpm {args[0]} {...restArgs}" command in all packages
        execr — run "{...args}" command in all packages
        hardreset — hardreset current package (remove, clone)
        hardresetr — hardreset all packages (remove, clone)
        link — link packages
        linkr — link packages recursive
        unlink — unlink packages
        fixlink | fl — link peer deps to project deps
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
        pbam | pboom — prepare bam | boom, not do it
        badaboom | x — update, commit, build, bump, push, publish, recursive-foxy
        bidibadaboom | xx — update, commit small fix, build, bump, push, publish, recursive-foxy
        pbadaboom | pbidibadaboom | px | pxx | xp | xxp — prepare badaboom, not do it
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
