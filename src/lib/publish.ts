import { build, isBuildable } from '@/lib/build'
import { update } from '@/lib/install'
import { link } from '@/lib/link'
import {
  getOrderedLibPackagesData,
  isCommitable,
  isSuitableLibPackagesActual,
  type LibPackageDataExtended,
  throwIfNotMasterBaranch,
} from '@/lib/utils'
import readlineSync from 'readline-sync'
import { exec, getPackageJson, log, spawn, stringsToLikeArrayString } from 'svag-cli-utils'

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
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd, include, exclude })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  let commitedSome = false
  let publishedSome = false
  for (const { libPackagePath } of libPackagesData) {
    const { commited, published } = await updateLinkCommitBuildBumpPushPublish({ cwd: libPackagePath, forceAccuracy })
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
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd, include, exclude })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  let commitedSome = false
  let publishedSome = false
  for (const { libPackagePath } of libPackagesData) {
    const { suitableLibPackagesActual } = await isSuitableLibPackagesActual({ cwd: libPackagePath, forceAccuracy })
    if (!suitableLibPackagesActual) {
      await update({ cwd: libPackagePath })
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
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd, include, exclude })
  if (!libPackagesData.length) {
    throw new Error('No packages found')
  }
  let nothingToCommitAndPublish = true
  for (const { libPackagePath } of libPackagesData) {
    const { suitableLibPackagesActual, notSuitableLibPackagesName } = await isSuitableLibPackagesActual({
      cwd: libPackagePath,
      forceAccuracy,
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
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd, include, exclude })
  const libPackagesDataCircular = libPackagesData.filter(({ circular }) => circular)
  const libPackagesDataNonircular = libPackagesData.filter(({ circular }) => !circular)
  const libPackagesDataCommitableCircular: LibPackageDataExtended[] = []
  for (const libPackageData of libPackagesData) {
    if (!libPackageData.circular) {
      continue
    }
    const { commitable } = await isCommitable({ cwd: libPackageData.libPackagePath })
    if (commitable) {
      libPackagesDataCommitableCircular.push(libPackageData)
    }
  }
  const libPackagesNamesNoncircular = libPackagesDataNonircular.map(({ libPackageName }) => libPackageName)
  const libPackagesNamesCircular = libPackagesDataCircular.map(({ libPackageName }) => libPackageName)
  const libPackagesNamesCommitableCircular = libPackagesDataCommitableCircular.map(
    ({ libPackageName }) => libPackageName
  )
  if (libPackagesDataCommitableCircular.length) {
    log.green(`circular commitable packages found: ${stringsToLikeArrayString(libPackagesNamesCommitableCircular)}`)
    log.green(`will twice hop with forceAccuracy circular deps: ${stringsToLikeArrayString(libPackagesNamesCircular)}`)
    for (const { libPackagePath } of [...libPackagesDataCircular, ...libPackagesDataCircular]) {
      await updateLinkCommitBuildBumpPushPublish({
        cwd: libPackagePath,
        forceAccuracy: true,
      })
    }
    log.green(`and then will hop noncircular as usual: ${stringsToLikeArrayString(libPackagesNamesNoncircular)}`)
    await updateLinkCommitBuildBumpPushPublishRecursive({
      cwd,
      include,
      exclude: [...libPackagesNamesCircular, ...(exclude || [])],
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
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd, include, exclude })
  const libPackagesDataCircular = libPackagesData.filter(({ circular }) => circular)
  const libPackagesDataNonircular = libPackagesData.filter(({ circular }) => !circular)
  const libPackagesDataCommitableCircular: LibPackageDataExtended[] = []
  for (const libPackageData of libPackagesData) {
    if (!libPackageData.circular) {
      continue
    }
    const { commitable } = await isCommitable({ cwd: libPackageData.libPackagePath })
    if (commitable) {
      libPackagesDataCommitableCircular.push(libPackageData)
    }
  }
  const libPackagesNamesNoncircular = libPackagesDataNonircular.map(({ libPackageName }) => libPackageName)
  const libPackagesNamesCircular = libPackagesDataCircular.map(({ libPackageName }) => libPackageName)
  const libPackagesNamesCommitableCircular = libPackagesDataCommitableCircular.map(
    ({ libPackageName }) => libPackageName
  )
  if (libPackagesDataCommitableCircular.length) {
    log.green(`circular commitable packages found: ${stringsToLikeArrayString(libPackagesNamesCommitableCircular)}`)
    log.green(`will twice hop with forceAccuracy circular deps: ${stringsToLikeArrayString(libPackagesNamesCircular)}`)
    for (const { libPackagePath } of [...libPackagesDataCircular, ...libPackagesDataCircular]) {
      await updateLinkCommitSmallFixBuildBumpPushPublish({
        cwd: libPackagePath,
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
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd, include, exclude })
  const libPackagesDataCircular = libPackagesData.filter(({ circular }) => circular)
  const libPackagesDataNonircular = libPackagesData.filter(({ circular }) => !circular)
  const libPackagesDataCommitableCircular: LibPackageDataExtended[] = []
  for (const libPackageData of libPackagesData) {
    if (!libPackageData.circular) {
      continue
    }
    const { commitable } = await isCommitable({ cwd: libPackageData.libPackagePath })
    if (commitable) {
      libPackagesDataCommitableCircular.push(libPackageData)
    }
  }
  const libPackagesNamesNoncircular = libPackagesDataNonircular.map(({ libPackageName }) => libPackageName)
  const libPackagesNamesCircular = libPackagesDataCircular.map(({ libPackageName }) => libPackageName)
  const libPackagesNamesCommitableCircular = libPackagesDataCommitableCircular.map(
    ({ libPackageName }) => libPackageName
  )
  if (libPackagesDataCommitableCircular.length) {
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
