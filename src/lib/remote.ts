import { getEnv } from '@/lib/env.js'
import { isGitRepo } from '@/lib/utils.js'
import axios from 'axios'
import { getPackageJson, log, spawn } from 'svag-cli-utils'

const normalizeGithubOrganization = async ({
  cwd,
  githubOrganization,
}: {
  cwd?: string
  githubOrganization?: string
}) => {
  githubOrganization = await (async () => {
    if (githubOrganization) {
      return githubOrganization
    }
    if (!cwd) {
      throw new Error('No cwd or githubOrganization provided')
    }
    const { packageJsonData } = await getPackageJson({ cwd })
    const pkgRepoUrl =
      typeof packageJsonData.repository === 'string' ? packageJsonData.repository : packageJsonData.repository?.url
    if (!pkgRepoUrl) {
      throw new Error('No repository URL found in package.json')
    }
    const pkgRepoUrlParts = pkgRepoUrl.split('/')
    const orgName = pkgRepoUrlParts[pkgRepoUrlParts.length - 2]
    return orgName
  })()
  if (!githubOrganization) {
    throw new Error('No GitHub organization found')
  }
  return githubOrganization
}

const normalizeRepositoryName = async ({ cwd, repositoryName }: { cwd?: string; repositoryName?: string }) => {
  repositoryName = await (async () => {
    if (repositoryName) {
      return repositoryName
    }
    if (!cwd) {
      throw new Error('No cwd or githubOrganization provided')
    }
    const { packageJsonData } = await getPackageJson({ cwd })
    const pkgRepoUrl =
      typeof packageJsonData.repository === 'string' ? packageJsonData.repository : packageJsonData.repository?.url
    if (!pkgRepoUrl) {
      throw new Error('No repository URL found in package.json')
    }
    const pkgRepoUrlParts = pkgRepoUrl.split('/')
    const lastPart = pkgRepoUrlParts[pkgRepoUrlParts.length - 1]
    const repoName = lastPart.replace(/\.git$/, '')
    return repoName
  })()
  if (!repositoryName) {
    throw new Error('No repository name found')
  }
  return repositoryName
}

export const createRemoteRepo = async ({
  cwd,
  repositoryName,
  githubOrganization,
  githubToken,
  isPublic,
}: {
  cwd?: string
  repositoryName?: string
  githubOrganization?: string
  githubToken?: string
  isPublic: boolean
}) => {
  repositoryName = await normalizeRepositoryName({ cwd, repositoryName })
  githubOrganization = await normalizeGithubOrganization({ cwd, githubOrganization })
  githubToken = githubToken || getEnv('GITHUB_TOKEN')
  log.normal(`Creating remote repository: ${repositoryName}`)
  await axios({
    method: 'post',
    url: `https://api.github.com/orgs/${githubOrganization}/repos`,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
    },
    data: {
      name: repositoryName,
      private: !isPublic,
    },
  })
  log.normal(`Remote repository created: ${repositoryName}`)
}

export const addRemoteOrigin = async ({
  cwd,
  githubOrganization,
  repositoryName,
}: {
  cwd: string
  githubOrganization?: string
  repositoryName?: string
}) => {
  githubOrganization = await normalizeGithubOrganization({ cwd, githubOrganization })
  repositoryName = await normalizeRepositoryName({ cwd, repositoryName })
  const url = `git@github.com:${githubOrganization}/${repositoryName}.git`
  const { gitRepo } = await isGitRepo({ cwd })
  if (!gitRepo) {
    await spawn({
      cwd,
      command: 'git init',
    })
  }
  await spawn({
    cwd,
    command: `git remote add origin ${url}`,
  })
}
