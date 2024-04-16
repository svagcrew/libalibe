import readlineSync from 'readline-sync'
import { exec, getPackageJson, spawn } from 'svag-cli-utils'
import { build, isBuildable } from './build'
import { installLatest } from './install'
import { link } from './link'
import {
  getOrderedLibPackagesData,
  isCommitable,
  isSuitableLibPackagesActual,
  log,
  throwIfNotMasterBaranch,
} from './utils'

// small helpers

const isLastCommitSetVersionSameToLatestTag = async ({ cwd }: { cwd: string }) => {
  const lastCommitMessageRaw = await exec({ cwd, command: `git log -1 --pretty=%B` })
  const lastCommitMessage = lastCommitMessageRaw.trim()
  const latestTagRaw = await exec({ cwd, command: `git describe --tags --abbrev=0` })
  const latestTag = latestTagRaw.trim().replace(/^v/, '')
  return {
    lastCommitSetVersionSameToLatestTag: lastCommitMessage === latestTag,
  }
}

const addAllAndCommit = async ({ cwd, message }: { cwd: string; message: string }) => {
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
}

// big helpers

const commitIfNeededWithPrompt = async ({ cwd }: { cwd: string }) => {
  const { commitable, commitableText } = await isCommitable({ cwd })
  if (!commitable) {
    return { commited: false, message: null }
  }
  log.green(`${cwd}: commiting
${commitableText}`)
  const message = readlineSync.question('Commit message (default: "Small fix"): ', {
    defaultInput: 'Small fix',
  })
  await addAllAndCommit({ cwd, message })
  log.toMemory.green(`${cwd}: commited (${message})`)
  return { commited: true, message }
}

const commitIfNeededWithMessage = async ({ cwd, message }: { cwd: string; message: string }) => {
  const { commitable, commitableText } = await isCommitable({ cwd })
  if (!commitable) {
    return { commited: false, message: null }
  }
  log.green(`${cwd}: commiting (${message})
${commitableText}`)
  await addAllAndCommit({ cwd, message })
  log.toMemory.green(`${cwd}: commited (${message})`)
  return { commited: true, message }
}

// actions

export const buildBumpPushPublish = async ({
  cwd,
  bump = 'patch',
}: {
  cwd: string
  bump?: 'patch' | 'major' | 'minor'
}) => {
  await throwIfNotMasterBaranch({ cwd })
  const { buildable } = await isBuildable({ cwd })
  if (buildable) {
    log.green(`${cwd}: building`)
    await build({ cwd })
  }
  const { packageJsonData: pjd1 } = await getPackageJson({ cwd })
  await spawn({ cwd, command: `pnpm version ${bump}` })
  const { packageJsonData: pjd2 } = await getPackageJson({ cwd })
  const oldVersion = pjd1.version
  const newVersion = pjd2.version
  log.green(`${cwd}: pushing`)
  await spawn({ cwd, command: `git push origin master` })
  log.green(`${cwd}: publishing`)
  await spawn({ cwd, command: `pnpm publish` })
  log.toMemory.green(`${cwd}: published ${oldVersion}→${newVersion}`)
}

export const commitBuildBumpPushPublish = async ({ cwd, message }: { cwd: string; message: string }) => {
  await throwIfNotMasterBaranch({ cwd })
  log.green(`${cwd}: commiting (${message})`)
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
  log.toMemory.green(`${cwd}: Ccmmited (${message})`)
  await buildBumpPushPublish({ cwd })
}

export const buildBumpPushPublishIfNotActual = async ({ cwd }: { cwd: string }) => {
  await throwIfNotMasterBaranch({ cwd })
  const { lastCommitSetVersionSameToLatestTag } = await isLastCommitSetVersionSameToLatestTag({ cwd })
  if (lastCommitSetVersionSameToLatestTag) {
    return { published: false }
  }
  await buildBumpPushPublish({ cwd })
  return { published: true }
}

export const updateCommitBuildBumpPushPublish = async ({ cwd }: { cwd: string }) => {
  const { suitableLibPackagesActual } = await isSuitableLibPackagesActual({ cwd })
  if (!suitableLibPackagesActual) {
    await installLatest({ cwd })
    await link({ cwd })
  }
  const { commited } = await commitIfNeededWithPrompt({ cwd })
  const { published } = await buildBumpPushPublishIfNotActual({ cwd })
  return { commited, published }
}

export const updateCommitBuildBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  let commitedSome = false
  let publishedSome = false
  for (const { libPackagePath } of libPackagesData) {
    const { commited, published } = await updateCommitBuildBumpPushPublish({ cwd: libPackagePath })
    commitedSome = commitedSome || commited
    publishedSome = publishedSome || published
  }
  if (!commitedSome && !publishedSome) {
    log.green(`${cwd}: nothing to commit and publish`)
  }
}

export const updateCommitSmallFixBuildBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  let commitedSome = false
  let publishedSome = false
  for (const { libPackagePath } of libPackagesData) {
    const { suitableLibPackagesActual } = await isSuitableLibPackagesActual({ cwd: libPackagePath })
    if (!suitableLibPackagesActual) {
      await installLatest({ cwd: libPackagePath })
      await link({ cwd: libPackagePath })
    }
    const { commited } = await commitIfNeededWithMessage({ cwd: libPackagePath, message: 'Small fix' })
    const { published } = await buildBumpPushPublishIfNotActual({ cwd: libPackagePath })
    commitedSome = commitedSome || commited
    publishedSome = publishedSome || published
  }
  if (!commitedSome && !publishedSome) {
    log.green(`nothing to commit and publish`)
  }
}

export const prepareUpdateCommitSmallFixBuildBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  let nothingToCommitAndPublish = true
  for (const { libPackagePath } of libPackagesData) {
    const { suitableLibPackagesActual, notSuitableLibPackagesName } = await isSuitableLibPackagesActual({
      cwd: libPackagePath,
    })
    if (!suitableLibPackagesActual) {
      nothingToCommitAndPublish = false
      log.green(`${libPackagePath}: not suitable packages found: ${notSuitableLibPackagesName.join(', ')}`)
    }
    const { commitable } = await isCommitable({ cwd: libPackagePath })
    if (commitable) {
      nothingToCommitAndPublish = false
      log.green(`${libPackagePath}: commitable`)
    }
  }
  if (nothingToCommitAndPublish) {
    log.green(`nothing to commit and publish`)
    return
  }
}
