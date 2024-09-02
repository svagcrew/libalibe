import { update } from '@/lib/install.js'
import { link } from '@/lib/link.js'
import {
  getOrderedRootLibPackagesData,
  isCommitable,
  isSuitableLibPackagesActual,
  type RootLibPackageDataExtended,
  throwIfNotMasterBaranch,
  updatePackageJsonVersion,
} from '@/lib/utils.js'
import readlineSync from 'readline-sync'
import { exec, getAllPackageJsonPaths, getPackageJson, log, spawn, stringsToLikeArrayString } from 'svag-cli-utils'

// small helpers

const isLastCommitSetVersionSameToLatestTag = async ({ cwd }: { cwd: string }) => {
  const lastCommitMessageRaw = await exec({ cwd, command: `git log -1 --pretty=%B` })
  const lastCommitMessage = lastCommitMessageRaw.trim()
  const latestTagRaw = await (async () => {
    try {
      return await exec({ cwd, command: `git describe --tags --abbrev=0` })
    } catch {
      return ''
    }
  })()
  const latestTag = latestTagRaw.trim().replace(/^v/, '')
  return {
    lastCommitSetVersionSameToLatestTag: lastCommitMessage === latestTag,
  }
}

const addAllAndCommit = async ({ cwd, message, noVerify }: { cwd: string; message: string; noVerify?: boolean }) => {
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"${noVerify ? ' --no-verify' : ''}` })
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
  log.toMemory.black(`${cwd}: commited (${message})`)
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
  log.toMemory.black(`${cwd}: commited (${message})`)
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
  // await throwIfNotMasterBaranch({ cwd })
  // const { buildable } = await isBuildable({ cwd })
  // if (buildable) {
  //   log.green(`${cwd}: building`)
  //   await build({ cwd })
  // }
  const { commitable } = await isCommitable({ cwd })
  if (commitable) {
    throw new Error(`Uncommited changes: ${cwd}`)
  }
  const { packageJsonData: pjd1, packageJsonPath } = await getPackageJson({ cwd })
  const oldVersion = pjd1.version
  const { newVersion } = await updatePackageJsonVersion({ packageJsonPath, version: bump })
  const { allPackageJsonsPathsAndDirs } = await getAllPackageJsonPaths({ cwd })
  for (const { packageJsonPath: workspacePackageJsonPath } of allPackageJsonsPathsAndDirs) {
    if (workspacePackageJsonPath === packageJsonPath) {
      continue
    }
    await updatePackageJsonVersion({ packageJsonPath: workspacePackageJsonPath, version: newVersion })
  }
  await addAllAndCommit({ cwd, message: newVersion, noVerify: true })
  await spawn({ cwd, command: `git tag v${newVersion}` })
  log.green(`${cwd}: pushing`)
  await spawn({ cwd, command: `git push origin main` })
  await spawn({ cwd, command: `git push origin v${newVersion}` })
  log.green(`${cwd}: publishing`)
  await spawn({ cwd, command: `pnpm recursive publish --access public` })
  log.toMemory.black(`${cwd}: published ${oldVersion}→${newVersion}`)
}

export const commitBuildBumpPushPublish = async ({ cwd, message }: { cwd: string; message: string }) => {
  await throwIfNotMasterBaranch({ cwd })
  log.green(`${cwd}: commiting (${message})`)
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
  log.toMemory.black(`${cwd}: Commited (${message})`)
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

export const updateLinkCommitBuildBumpPushPublish = async ({
  cwd,
  forceAccuracy,
}: {
  cwd: string
  forceAccuracy?: boolean
}) => {
  const { suitableLibPackagesActual } = await isSuitableLibPackagesActual({ cwd, forceAccuracy })
  if (!suitableLibPackagesActual) {
    await update({ cwd })
    await link({ cwd })
  }
  const { commited } = await commitIfNeededWithPrompt({ cwd })
  const { published } = await buildBumpPushPublishIfNotActual({ cwd })
  return { commited, published }
}

export const updateLinkCommitSmallFixBuildBumpPushPublish = async ({
  cwd,
  forceAccuracy,
}: {
  cwd: string
  forceAccuracy?: boolean
}) => {
  const { suitableLibPackagesActual } = await isSuitableLibPackagesActual({ cwd, forceAccuracy })
  if (!suitableLibPackagesActual) {
    await update({ cwd })
    await link({ cwd })
  }
  const { commited } = await commitIfNeededWithMessage({ cwd, message: 'Small fix' })
  const { published } = await buildBumpPushPublishIfNotActual({ cwd })
  return { commited, published }
}

export const updateLinkCommitBuildBumpPushPublishRecursive = async ({
  cwd,
  include,
  exclude,
  forceAccuracy,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
  forceAccuracy?: boolean
}) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd, include, exclude })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  let commitedSome = false
  let publishedSome = false
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { commited, published } = await updateLinkCommitBuildBumpPushPublish({
      cwd: rootLibPackagePath,
      forceAccuracy,
    })
    commitedSome = commitedSome || commited
    publishedSome = publishedSome || published
  }
  if (!commitedSome && !publishedSome) {
    log.green(`${cwd}: nothing to commit and publish`)
  }
}

export const updateLinkCommitSmallFixBuildBumpPushPublishRecursive = async ({
  cwd,
  include,
  exclude,
  forceAccuracy,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
  forceAccuracy?: boolean
}) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd, include, exclude })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  let nothingToCommitAndPublish = true
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { suitableLibPackagesActual, notSuitableLibPackagesName } = await isSuitableLibPackagesActual({
      cwd: rootLibPackagePath,
      forceAccuracy,
    })
    if (!suitableLibPackagesActual) {
      log.green(`${rootLibPackagePath}: not suitable packages found: ${notSuitableLibPackagesName.join(', ')}`)
      nothingToCommitAndPublish = false
      await update({ cwd: rootLibPackagePath })
      await link({ cwd: rootLibPackagePath })
    }
    const { commitable } = await isCommitable({ cwd: rootLibPackagePath })
    if (commitable) {
      nothingToCommitAndPublish = false
      await commitIfNeededWithMessage({ cwd: rootLibPackagePath, message: 'Small fix' })
      await buildBumpPushPublishIfNotActual({ cwd: rootLibPackagePath })
    }
  }
  if (nothingToCommitAndPublish) {
    log.green(`nothing to commit and publish`)
  }
}

export const prepareUpdateLinkCommitBuildBumpPushPublishRecursive = async ({
  cwd,
  include,
  exclude,
  forceAccuracy,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
  forceAccuracy?: boolean
}) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd, include, exclude })
  if (!rootLibPackagesData.length) {
    throw new Error('No packages found')
  }
  let nothingToCommitAndPublish = true
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { suitableLibPackagesActual, notSuitableLibPackagesName } = await isSuitableLibPackagesActual({
      cwd: rootLibPackagePath,
      forceAccuracy,
    })
    if (!suitableLibPackagesActual) {
      nothingToCommitAndPublish = false
      log.green(`${rootLibPackagePath}: not suitable packages found: ${notSuitableLibPackagesName.join(', ')}`)
    }
    const { commitable } = await isCommitable({ cwd: rootLibPackagePath })
    if (commitable) {
      nothingToCommitAndPublish = false
      log.green(`${rootLibPackagePath}: commitable`)
    }
  }
  if (nothingToCommitAndPublish) {
    log.green(`nothing to commit and publish`)
  }
}

export const updateLinkCommitBuildBumpPushPublishRecursiveFoxy = async ({
  cwd,
  include,
  exclude,
  forceAccuracy,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
  forceAccuracy?: boolean
}) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd, include, exclude })
  const rootLibPackagesDataCircular = rootLibPackagesData.filter(({ circular }) => circular)
  const rootLibPackagesDataNonircular = rootLibPackagesData.filter(({ circular }) => !circular)
  const rootLibPackagesDataCommitableCircular: RootLibPackageDataExtended[] = []
  for (const rootLibPackageData of rootLibPackagesData) {
    if (!rootLibPackageData.circular) {
      continue
    }
    const { commitable } = await isCommitable({ cwd: rootLibPackageData.rootLibPackagePath })
    if (commitable) {
      rootLibPackagesDataCommitableCircular.push(rootLibPackageData)
    }
  }
  const rootLibPackagesNamesNoncircular = rootLibPackagesDataNonircular.map(
    ({ rootLibPackageName }) => rootLibPackageName
  )
  const rootLibPackagesNamesCircular = rootLibPackagesDataCircular.map(({ rootLibPackageName }) => rootLibPackageName)
  const rootLibPackagesNamesCommitableCircular = rootLibPackagesDataCommitableCircular.map(
    ({ rootLibPackageName }) => rootLibPackageName
  )
  if (rootLibPackagesDataCommitableCircular.length) {
    log.green(`circular commitable packages found: ${stringsToLikeArrayString(rootLibPackagesNamesCommitableCircular)}`)
    log.green(
      `will twice hop with forceAccuracy circular deps: ${stringsToLikeArrayString(rootLibPackagesNamesCircular)}`
    )
    for (const { rootLibPackagePath } of [...rootLibPackagesDataCircular, ...rootLibPackagesDataCircular]) {
      await updateLinkCommitBuildBumpPushPublish({
        cwd: rootLibPackagePath,
        forceAccuracy: true,
      })
    }
    log.green(`and then will hop noncircular as usual: ${stringsToLikeArrayString(rootLibPackagesNamesNoncircular)}`)
    await updateLinkCommitBuildBumpPushPublishRecursive({
      cwd,
      include,
      exclude: [...rootLibPackagesNamesCircular, ...(exclude || [])],
      forceAccuracy,
    })
  } else {
    log.green(`circular commitable packages not found, will install all as usual`)
    await updateLinkCommitBuildBumpPushPublishRecursive({ cwd, include, forceAccuracy })
  }
}

export const updateLinkCommitSmallFixBuildBumpPushPublishRecursiveFoxy = async ({
  cwd,
  include,
  exclude,
  forceAccuracy,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
  forceAccuracy?: boolean
}) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd, include, exclude })
  const rootLibPackagesDataCircular = rootLibPackagesData.filter(({ circular }) => circular)
  const rootLibPackagesDataNonircular = rootLibPackagesData.filter(({ circular }) => !circular)
  const rootLibPackagesDataCommitableCircular: RootLibPackageDataExtended[] = []
  for (const rootLibPackageData of rootLibPackagesData) {
    if (!rootLibPackageData.circular) {
      continue
    }
    const { commitable } = await isCommitable({ cwd: rootLibPackageData.rootLibPackagePath })
    if (commitable) {
      rootLibPackagesDataCommitableCircular.push(rootLibPackageData)
    }
  }
  const libPackagesNamesNoncircular = rootLibPackagesDataNonircular.map(({ rootLibPackageName }) => rootLibPackageName)
  const libPackagesNamesCircular = rootLibPackagesDataCircular.map(({ rootLibPackageName }) => rootLibPackageName)
  const libPackagesNamesCommitableCircular = rootLibPackagesDataCommitableCircular.map(
    ({ rootLibPackageName }) => rootLibPackageName
  )
  if (rootLibPackagesDataCommitableCircular.length) {
    log.green(`circular commitable packages found: ${stringsToLikeArrayString(libPackagesNamesCommitableCircular)}`)
    log.green(`will twice hop with forceAccuracy circular deps: ${stringsToLikeArrayString(libPackagesNamesCircular)}`)
    for (const { rootLibPackagePath } of [...rootLibPackagesDataCircular, ...rootLibPackagesDataCircular]) {
      await updateLinkCommitSmallFixBuildBumpPushPublish({
        cwd: rootLibPackagePath,
        forceAccuracy: true,
      })
    }
    log.green(`and then will hop noncircular as usual: ${stringsToLikeArrayString(libPackagesNamesNoncircular)}`)
    await updateLinkCommitSmallFixBuildBumpPushPublishRecursive({
      cwd,
      include,
      exclude: [...libPackagesNamesCircular, ...(exclude || [])],
      forceAccuracy,
    })
  } else {
    log.green(`circular commitable packages not found, will install all as usual`)
    await updateLinkCommitSmallFixBuildBumpPushPublishRecursive({ cwd, include, forceAccuracy })
  }
}

export const prepareUpdateLinkCommitBuildBumpPushPublishRecursiveFoxy = async ({
  cwd,
  include,
  exclude,
  forceAccuracy,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
  forceAccuracy?: boolean
}) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd, include, exclude })
  const rootLibPackagesDataCircular = rootLibPackagesData.filter(({ circular }) => circular)
  const rootLibPackagesDataNonircular = rootLibPackagesData.filter(({ circular }) => !circular)
  const rootLibPackagesDataCommitableCircular: RootLibPackageDataExtended[] = []
  for (const rootLibPackageData of rootLibPackagesData) {
    if (!rootLibPackageData.circular) {
      continue
    }
    const { commitable } = await isCommitable({ cwd: rootLibPackageData.rootLibPackagePath })
    if (commitable) {
      rootLibPackagesDataCommitableCircular.push(rootLibPackageData)
    }
  }
  const libPackagesNamesNoncircular = rootLibPackagesDataNonircular.map(({ rootLibPackageName }) => rootLibPackageName)
  const libPackagesNamesCircular = rootLibPackagesDataCircular.map(({ rootLibPackageName }) => rootLibPackageName)
  const libPackagesNamesCommitableCircular = rootLibPackagesDataCommitableCircular.map(
    ({ rootLibPackageName }) => rootLibPackageName
  )
  if (rootLibPackagesDataCommitableCircular.length) {
    log.green(`circular commitable packages found: ${stringsToLikeArrayString(libPackagesNamesCommitableCircular)}`)
    log.green(`will twice hop with forceAccuracy circular deps: ${stringsToLikeArrayString(libPackagesNamesCircular)}`)
    log.green(`and then will hop noncircular as usual: ${stringsToLikeArrayString(libPackagesNamesNoncircular)}`)
    await prepareUpdateLinkCommitBuildBumpPushPublishRecursive({
      cwd,
      include,
      exclude: libPackagesNamesCircular,
      forceAccuracy,
    })
  } else {
    log.green(`circular commitable packages not found, will install all as usual`)
    await prepareUpdateLinkCommitBuildBumpPushPublishRecursive({ cwd, include, forceAccuracy })
  }
}
