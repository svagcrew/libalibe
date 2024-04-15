import readlineSync from 'readline-sync'
import { getConfig } from './config'
import { exec, spawn } from './exec'
import { installLatest } from './install'
import { getOrderedLibPackagesData, getPackageJsonData, isSuitableLibPackagesActual } from './utils'
import { link } from './link'

// small helpers

// const isGitRepo = async ({ cwd }: { cwd: string }) => {
//   try {
//     await spawn({ cwd, command: `git status --porcelain`, verbose: false })
//     return true
//   } catch (error) {
//     return false
//   }
// }

const isCommitable = async ({ cwd }: { cwd: string }) => {
  const out = await spawn({ cwd, command: `git status --porcelain`, verbose: false })
  return {
    commitable: Boolean(out.trim()),
    commitableText: out.trim(),
  }
}

const isMasterBaranch = async ({ cwd }: { cwd: string }) => {
  const out = await exec({ cwd, command: `git branch --show-current` })
  return {
    masterBaranch: out.trim() === 'master',
    currentBranch: out.trim(),
  }
}

const throwIfNotMasterBaranch = async ({ cwd }: { cwd: string }) => {
  const { masterBaranch, currentBranch } = await isMasterBaranch({ cwd })
  if (!masterBaranch) {
    throw new Error(`Not on master branch (${currentBranch}): ${cwd}`)
  }
}

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
  console.info(`Commiting (${packageJsonData.name}): ${cwd}
${commitableText}`)
  const message = readlineSync.question('Commit message (default: "Small fix"): ', {
    defaultInput: 'Small fix',
  })
  await addAllAndCommit({ cwd, message })
  return { commited: true, message }
}

// actions

export const bumpPushPublish = async ({ cwd, bump = 'patch' }: { cwd: string; bump?: 'patch' | 'major' | 'minor' }) => {
  await throwIfNotMasterBaranch({ cwd })
  await spawn({ cwd, command: `pnpm version ${bump}` })
  await spawn({ cwd, command: `git push origin master` })
  await spawn({ cwd, command: `pnpm publish` })
}

export const commitBumpPushPublish = async ({ cwd, message }: { cwd: string; message: string }) => {
  await throwIfNotMasterBaranch({ cwd })
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
  await bumpPushPublish({ cwd })
}

export const bumpPushPublishIfNotActual = async ({ cwd }: { cwd: string }) => {
  await throwIfNotMasterBaranch({ cwd })
  const { lastCommitSetVersionSameToLatestTag } = await isLastCommitSetVersionSameToLatestTag({ cwd })
  if (lastCommitSetVersionSameToLatestTag) {
    // console.info(`Already actual (${packageJsonData.name}): ${cwd}`)
    return { published: false }
  }
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  console.info(`Publishing (${packageJsonData.name}): ${cwd}`)
  await bumpPushPublish({ cwd })
  return { published: true }
}

export const commitBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
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
    const { published } = await bumpPushPublishIfNotActual({ cwd: libPackagePath })
    commitedSome = commitedSome || commited
    publishedSome = publishedSome || published
  }
  if (!commitedSome && !publishedSome) {
    console.info('Nothing to commit and publish')
  }
}
