import { exec, getDirInfo, isDirExists, spawn } from 'svag-cli-utils'
import { getConfig } from './config'
import { createDirIfNotExists, isCommitable, isGitRepo } from './utils'

const pull = async ({ cwd }: { cwd: string }) => {
  const { dirExists } = await isDirExists({ cwd })
  if (!dirExists) {
    throw new Error(`${cwd}: no such directory`)
  }
  const { gitRepo } = await isGitRepo({ cwd })
  if (!gitRepo) {
    throw new Error(`${cwd}: not a git repo`)
  }
  const { commitable } = await isCommitable({ cwd })
  if (commitable) {
    throw new Error(`${cwd}: uncommited changes`)
  }
  await spawn({ cwd, command: `git pull origin master` })
}

const clone = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { dirExists, dirEmpty } = await getDirInfo({ cwd })
  if (dirExists && !dirEmpty) {
    throw new Error(`${cwd}: directory is not empty`)
  }
  await createDirIfNotExists({ cwd })
  const url = (await exec({ cwd, command: `npm view ${libPackageName} repository.url` })).trim()
  if (!url) {
    throw new Error(`No repository.url in ${libPackageName}`)
  }
  await spawn({ cwd, command: `git clone ${url} .` })
}

const pullOrClone = async ({ libPackageName, libPackagePath }: { libPackageName: string; libPackagePath: string }) => {
  const { dirExists } = await isDirExists({ cwd: libPackagePath })
  const { gitRepo } = dirExists ? await isGitRepo({ cwd: libPackagePath }) : { gitRepo: false }
  if (gitRepo) {
    await pull({ cwd: libPackagePath })
  } else {
    await clone({ cwd: libPackagePath, libPackageName })
  }
}

export const pullOrCloneRecursive = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ cwd })
  const entries = Object.entries(config.items)
  if (!entries.length) {
    throw new Error('No packages found')
  }
  for (const [libPackageName, libPackagePath] of entries) {
    await pullOrClone({ libPackageName, libPackagePath })
  }
}
