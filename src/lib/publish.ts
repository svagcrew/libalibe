import { getConfig, getPackageJsonData } from './config'
import { exec, spawn } from './utils'
import readlineSync from 'readline-sync'

export const bumpPushPublish = async ({ cwd, bump = 'patch' }: { cwd: string; bump?: 'patch' | 'major' | 'minor' }) => {
  await spawn({ cwd, command: `pnpm version ${bump}` })
  await spawn({ cwd, command: `git push origin master` })
  await spawn({ cwd, command: `pnpm publish` })
}

export const commitBumpPushPublish = async ({ cwd, message }: { cwd: string; message: string }) => {
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
  await bumpPushPublish({ cwd })
}

const commitIfSomeChangesWithPrompt = async ({ cwd }: { cwd: string }) => {
  const out = await exec({ cwd, command: `git status --porcelain`, verbose: false })
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  if (!out) {
    // console.info(`Nothing to commit (${packageJsonData.name}): ${cwd}`)
    return { commited: false, message: null }
  }
  console.info(`Commiting (${packageJsonData.name}): ${cwd}
${out.trim()}`)
  const message = readlineSync.question('Commit message (default: "Small fix"): ', {
    defaultInput: 'Small fix',
  })
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
  return { commited: true, message }
}

export const bumpPushPublishIfNotActual = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  const latestTagRaw = await exec({ cwd, command: `git describe --tags --abbrev=0`, verbose: false })
  const latestTag = latestTagRaw.trim().replace(/^v/, '')
  const lastCommitMessageRaw = await exec({ cwd, command: `git log -1 --pretty=%B`, verbose: false })
  const lastCommitMessage = lastCommitMessageRaw.trim()
  if (latestTag === lastCommitMessage) {
    // console.info(`Already actual (${packageJsonData.name}): ${cwd}`)
    return { published: false }
  }
  console.info(`Publishing (${packageJsonData.name}): ${cwd}`)
  await bumpPushPublish({ cwd })
  return { published: true }
}

export const commitBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ dirPath: cwd })
  const packagesPaths = Object.values(config.items)
  if (!packagesPaths.length) {
    throw new Error('No packages found')
  }
  let commitedSome = false
  let publishedSome = false
  for (const packagePath of packagesPaths) {
    const { commited } = await commitIfSomeChangesWithPrompt({ cwd: packagePath })
    const { published } = await bumpPushPublishIfNotActual({ cwd: packagePath })
    commitedSome = commitedSome || commited
    publishedSome = publishedSome || published
  }
  if (!commitedSome && !publishedSome) {
    console.info('Nothing to commit and publish')
  }
}
