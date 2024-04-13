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
    console.info(`Nothing to commit (${packageJsonData.name}): ${cwd}`)
    return
  }
  console.info(`Will be commmitted (${packageJsonData.name}): ${cwd}
${out.trim()}`)
  const message = readlineSync.question('Commit message (default: "Small fix"): ', {
    defaultInput: 'Small fix',
  })
  // await spawn({ cwd, command: `git add -A` })
  // await spawn({ cwd, command: `git commit -m "${message}"` })
}

export const bumpPushPublishIfNotActual = async ({ cwd }: { cwd: string }) => {
  // actual when head is on the latest tag
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  const latestTag = await exec({ cwd, command: `git describe --tags --abbrev=0` })
  if (latestTag.trim() === packageJsonData.version) {
    console.info(`Already actual (${packageJsonData.name}): ${cwd}`)
    return
  }
  console.info(`Will be bumpPushPublish (${packageJsonData.name}): ${cwd}`)
  // await bumpPushPublish({ cwd })
}

export const commitBumpPushPublishRecursive = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ dirPath: cwd })
  const packagesPaths = Object.values(config.items)
  if (!packagesPaths.length) {
    throw new Error('No packages found')
  }
  for (const packagePath of packagesPaths) {
    await commitIfSomeChangesWithPrompt({ cwd: packagePath })
    await bumpPushPublishIfNotActual({ cwd: packagePath })
  }
}
