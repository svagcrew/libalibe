import { getConfig } from './config'
import { exec, spawn } from './exec'
import { createDirIfNotExists, isCommitable, isDirEmpty, isDirExists, isGitRepo } from './utils'

const pull = async ({ cwd }: { cwd: string }) => {
  const { dirExists } = await isDirExists({ cwd })
  if (!dirExists) {
    throw new Error(`No such directory: ${cwd}`)
  }
  const { gitRepo } = await isGitRepo({ cwd })
  if (!gitRepo) {
    throw new Error(`Not a git repo in ${cwd}`)
  }
  const { commitable } = await isCommitable({ cwd })
  if (commitable) {
    throw new Error(`Uncommited changes in ${cwd}`)
  }
  await spawn({ cwd, command: `git pull origin master` })
}

const clone = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { dirExists } = await isDirExists({ cwd })
  const { dirEmpty } = dirExists ? await isDirEmpty({ cwd }) : { dirEmpty: true }
  if (dirExists && !dirEmpty) {
    throw new Error(`Directory is not empty: ${cwd}`)
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
  const { config } = await getConfig({ dirPath: cwd })
  const entries = Object.entries(config.items)
  if (!entries.length) {
    throw new Error('No packages found')
  }
  for (const [libPackageName, libPackagePath] of entries) {
    await pullOrClone({ libPackageName, libPackagePath })
  }
}
