import readlineSync from 'readline-sync'
import { build, isBuildable } from './build'
import { exec, spawn } from './exec'
import { installLatest } from './install'
import { link } from './link'
import {
  getOrderedLibPackagesData,
  getPackageJsonData,
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
    // console.info(`Nothing to commit (${packageJsonData.name}): ${cwd}`)
    return { commited: false, message: null }
  }
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  log.green(`Commiting (${packageJsonData.name}): ${cwd}
${commitableText}`)
  const message = readlineSync.question('Commit message (default: "Small fix"): ', {
    defaultInput: 'Small fix',
  })
  await addAllAndCommit({ cwd, message })
  return { commited: true, message }
}

const commitIfNeededWithMessage = async ({ cwd, message }: { cwd: string; message: string }) => {
  const { commitable, commitableText } = await isCommitable({ cwd })
  if (!commitable) {
    // console.info(`Nothing to commit (${packageJsonData.name}): ${cwd}`)
    return { commited: false, message: null }
  }
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  log.green(`Commiting (${packageJsonData.name}): ${cwd}
${commitableText}`)
  await addAllAndCommit({ cwd, message })
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
    log.green(`Building ${cwd}`)
    await build({ cwd })
  }
  await spawn({ cwd, command: `pnpm version ${bump}` })
  await spawn({ cwd, command: `git push origin master` })
  await spawn({ cwd, command: `pnpm publish` })
}

export const commitBuildBumpPushPublish = async ({ cwd, message }: { cwd: string; message: string }) => {
  await throwIfNotMasterBaranch({ cwd })
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
  await buildBumpPushPublish({ cwd })
}

export const buildBumpPushPublishIfNotActual = async ({ cwd }: { cwd: string }) => {
  await throwIfNotMasterBaranch({ cwd })
  const { lastCommitSetVersionSameToLatestTag } = await isLastCommitSetVersionSameToLatestTag({ cwd })
  if (lastCommitSetVersionSameToLatestTag) {
    // console.info(`Already actual (${packageJsonData.name}): ${cwd}`)
    return { published: false }
  }
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  log.green(`Publishing (${packageJsonData.name}): ${cwd}`)
  await buildBumpPushPublish({ cwd })
  return { published: true }
}

export const commitBuildBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
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
    const { commited } = await commitIfNeededWithPrompt({ cwd: libPackagePath })
    const { published } = await buildBumpPushPublishIfNotActual({ cwd: libPackagePath })
    commitedSome = commitedSome || commited
    publishedSome = publishedSome || published
  }
  if (!commitedSome && !publishedSome) {
    log.green(`Nothing to commit and publish in ${cwd}`)
  }
}

export const commitSmallFixBuildBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
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
    log.green(`Nothing to commit and publish in ${cwd}`)
  }
}
