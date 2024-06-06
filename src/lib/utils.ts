import { getConfig } from '@/lib/config.js'
import _ from 'lodash'
import semver from 'semver'
import { createDir, exec, getPackageJson, isDirExists } from 'svag-cli-utils'
import type { PackageJson } from 'type-fest'

export type PackageJsonDataLibalibe =
  | {
      ignoreSelfVersionAccuracy?: boolean
      ignoreDependeciesVersionAccuracy?: string[]
    }
  | undefined
export type LibPackageData = { libPackageName: string; libPackagePath: string; libPackageJsonData: PackageJson }
export type LibPackageDataExtended = LibPackageData & {
  dependency: boolean
  circular: boolean
}

export const getSuitableLibPackages = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ cwd })
  const { packageJsonData: projectPackageJsonData } = await getPackageJson({ cwd })
  const libPackagesNames = Object.keys(config.items)
  const devDependencies = Object.keys(projectPackageJsonData.devDependencies || {})
  const prodDependencies = Object.keys(projectPackageJsonData.dependencies || {})
  const allDependencies = [...new Set([...devDependencies, ...prodDependencies])]
  const suitablePackagesNames = libPackagesNames.filter((libPackageName) => allDependencies.includes(libPackageName))
  const suitableDevPackagesNames = libPackagesNames.filter((libPackageName) => devDependencies.includes(libPackageName))
  const suitableProdPackagesNames = libPackagesNames.filter((libPackageName) =>
    prodDependencies.includes(libPackageName)
  )
  const nonsuitablePackagesNames = libPackagesNames.filter(
    (libPackageName) => !allDependencies.includes(libPackageName)
  )
  const suitablePackagesWithVersion = Object.fromEntries(
    Object.entries({
      ...projectPackageJsonData.devDependencies,
      ...projectPackageJsonData.dependencies,
    }).filter(([key]) => suitablePackagesNames.includes(key))
  )
  return {
    suitablePackagesNames,
    suitableDevPackagesNames,
    suitableProdPackagesNames,
    nonsuitablePackagesNames,
    suitablePackagesWithVersion,
  }
}

export const getLibPackagePath = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { config } = await getConfig({ cwd })
  const libPackagePath = config.items[libPackageName]
  if (!libPackagePath) {
    throw new Error(`Invalid lib package name: "${libPackageName}"`)
  }
  return { libPackagePath }
}

export const getLibPackagesPaths = async ({ cwd, libPackagesNames }: { cwd: string; libPackagesNames: string[] }) => {
  const libPackagesPaths = await Promise.all(
    libPackagesNames.map(async (libPackageName) => {
      const { libPackagePath } = await getLibPackagePath({ cwd, libPackageName })
      return libPackagePath
    })
  )
  return { libPackagesPaths }
}

export const getLibPackageJsonData = async ({
  cwd,
  libPackageName,
}: {
  cwd: string
  libPackageName: string
}): Promise<{
  libPackageJsonData: PackageJson
}> => {
  const { libPackagePath } = await getLibPackagePath({ cwd, libPackageName })
  const { packageJsonData: libPackageJsonData } = await getPackageJson({ cwd: libPackagePath })
  return { libPackageJsonData } as { libPackageJsonData: PackageJson }
}

export const isSuitableLibPackageActual = async ({
  cwd,
  libPackageName,
  forceAccuracy,
}: {
  cwd: string
  libPackageName: string
  forceAccuracy?: boolean
}) => {
  const { packageJsonData: projectPackageJsonData } = await getPackageJson({ cwd })
  const { suitablePackagesWithVersion } = await getSuitableLibPackages({
    cwd,
  })
  const projectLibPackageVersionRaw = suitablePackagesWithVersion[libPackageName]
  if (!projectLibPackageVersionRaw) {
    throw new Error(`${cwd}: version not found "${libPackageName}"`)
  }
  const projectLibPackageVersionExact = projectLibPackageVersionRaw.match(/(\d+\.\d+\.\d+)/)?.[0]
  const { libPackageJsonData } = await getLibPackageJsonData({ cwd, libPackageName })
  if (!projectLibPackageVersionExact) {
    return { suitableLibPackageActual: false }
  }
  if (!libPackageJsonData.version) {
    return { suitableLibPackageActual: false }
  }
  const projectPackageJsonDataLibalibe = (projectPackageJsonData as any).libalibe as PackageJsonDataLibalibe
  const libPackageJsonDataLibalibe = (libPackageJsonData as any).libalibe as PackageJsonDataLibalibe
  const { libPackagesData } = await getOrderedLibPackagesData({ cwd })
  const libPackageData = libPackagesData.find((pkg) => pkg.libPackageName === libPackageName)
  if (!libPackageData) {
    throw new Error(`${cwd}: lib package data not found "${libPackageName}"`)
  }
  const circular = isLibPackageCircularDependency({
    libPackageData,
    libPackagesData,
  })
  const ignoreVersionAccuracy =
    projectPackageJsonDataLibalibe?.ignoreDependeciesVersionAccuracy?.includes(libPackageName) ||
    libPackageJsonDataLibalibe?.ignoreSelfVersionAccuracy ||
    circular
  if (!forceAccuracy && ignoreVersionAccuracy) {
    return { suitableLibPackageActual: semver.satisfies(libPackageJsonData.version, projectLibPackageVersionRaw) }
  }
  return {
    suitableLibPackageActual: semver.eq(projectLibPackageVersionExact, libPackageJsonData.version),
  }
}

const isThisLibPackageDependencyOfThatLibPackage = ({
  thisLibPackageJsonData,
  thatLibPackageJsonData,
}: {
  thisLibPackageJsonData: PackageJson
  thatLibPackageJsonData: PackageJson
}) => {
  const thatLibPackageJsonDataDeps = {
    ...thatLibPackageJsonData.devDependencies,
    ...thatLibPackageJsonData.dependencies,
  }
  const thisLibPackageName = thisLibPackageJsonData.name
  return {
    thisLibPackageDependencyOfThatLibPackage: !!thisLibPackageName && !!thatLibPackageJsonDataDeps[thisLibPackageName],
  }
}

const isThisLibPackageDependsOnThatLibPackage = ({
  thisLibPackageJsonData,
  thatLibPackageJsonData,
}: {
  thisLibPackageJsonData: PackageJson
  thatLibPackageJsonData: PackageJson
}) => {
  const thisLibPackageJsonDataDeps = {
    ...thisLibPackageJsonData.devDependencies,
    ...thisLibPackageJsonData.dependencies,
  }
  const thatLibPackageName = thatLibPackageJsonData.name
  return {
    thisLibPackageDependsOnThatLibPackage: !!thatLibPackageName && !!thisLibPackageJsonDataDeps[thatLibPackageName],
  }
}

const isLibPackageDependencyOfAnother = ({
  libPackageData,
  libPackagesData,
}: {
  libPackageData: LibPackageData
  libPackagesData: LibPackageData[]
}) => {
  const dependencies = libPackagesData.filter(
    (pkg) =>
      isThisLibPackageDependencyOfThatLibPackage({
        thisLibPackageJsonData: libPackageData.libPackageJsonData,
        thatLibPackageJsonData: pkg.libPackageJsonData,
      }).thisLibPackageDependencyOfThatLibPackage && pkg.libPackageName !== libPackageData.libPackageName
  )
  return dependencies.length > 0
}

const isLibPackageCircularDependency = ({
  libPackageData,
  libPackagesData,
}: {
  libPackageData: LibPackageData
  libPackagesData: LibPackageData[]
}) => {
  const visited = new Set<number>()
  const onStack = new Set<number>()
  let hasCycle = false

  const visit = (nodeIndex: number) => {
    if (onStack.has(nodeIndex)) {
      hasCycle = true
      return // Cycle detected
    }
    if (visited.has(nodeIndex)) {
      return // Already processed
    }
    visited.add(nodeIndex)
    onStack.add(nodeIndex)

    const currentNode = libPackagesData[nodeIndex]
    const dependencies = libPackagesData.filter(
      (pkg, idx) =>
        idx !== nodeIndex &&
        isThisLibPackageDependencyOfThatLibPackage({
          thisLibPackageJsonData: currentNode.libPackageJsonData,
          thatLibPackageJsonData: pkg.libPackageJsonData,
        }).thisLibPackageDependencyOfThatLibPackage
    )

    for (const dep of dependencies) {
      const depIndex = libPackagesData.indexOf(dep)
      visit(depIndex)
      if (hasCycle) {
        continue
      }
    }

    onStack.delete(nodeIndex)
  }

  const nodeIndexOutside = libPackagesData.indexOf(libPackageData)
  if (nodeIndexOutside > -1) {
    visit(nodeIndexOutside)
  }
  return hasCycle
}

export const orderLibPackagesFromDependsOnToDependent = ({
  libPackagesData,
}: {
  libPackagesData: LibPackageData[]
}) => {
  const libPackagesDataExtended = _.cloneDeep(libPackagesData).map((libPackageData) => ({
    ...libPackageData,
    dependency: false,
    circular: false,
  })) as LibPackageDataExtended[]

  // TODO: check if this is correct
  const getOrderString = (libPackagesDataInside: LibPackageData[]) => {
    return libPackagesDataInside.map(({ libPackageName }) => libPackageName).join('|')
  }
  const knownOrders = [getOrderString(libPackagesDataExtended)]
  for (let i = 0; i < libPackagesDataExtended.length; i++) {
    for (let j = i + 1; j < libPackagesDataExtended.length; j++) {
      const { thisLibPackageDependsOnThatLibPackage } = isThisLibPackageDependsOnThatLibPackage({
        thisLibPackageJsonData: libPackagesDataExtended[i].libPackageJsonData,
        thatLibPackageJsonData: libPackagesDataExtended[j].libPackageJsonData,
      })
      if (thisLibPackageDependsOnThatLibPackage) {
        const libPackageData = libPackagesDataExtended.splice(j, 1)[0]
        libPackageData.dependency = true
        libPackagesDataExtended.splice(i, 0, libPackageData)
        if (!knownOrders.includes(getOrderString(libPackagesDataExtended))) {
          i--
          knownOrders.push(getOrderString(libPackagesDataExtended))
        }
        break
      }
    }
  }

  for (const libPackageDataExtended of libPackagesDataExtended) {
    libPackageDataExtended.dependency = isLibPackageDependencyOfAnother({
      libPackageData: libPackageDataExtended,
      libPackagesData: libPackagesDataExtended,
    })
    libPackageDataExtended.circular = isLibPackageCircularDependency({
      libPackageData: libPackageDataExtended,
      libPackagesData: libPackagesDataExtended,
    })
  }

  const libPackagesDataExtendedOrdered = _.orderBy(
    libPackagesDataExtended,
    ['dependency', 'circular'],
    ['desc', 'desc']
  )

  return { libPackagesDataOrdered: libPackagesDataExtendedOrdered }
}

export const getOrderedLibPackagesData = async ({
  cwd,
  include,
  exclude,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
}) => {
  const { config } = await getConfig({ cwd })
  const libPackagesDataNonOrdered: LibPackageData[] = []
  for (const [libPackageName, libPackagePath] of Object.entries(config.items)) {
    const { packageJsonData: libPackageJsonData } = await getPackageJson({ cwd: libPackagePath })
    const existsInInclude = !include || include.includes(libPackageName)
    const notExistsInExclude = !exclude?.includes(libPackageName)
    if (existsInInclude && notExistsInExclude) {
      libPackagesDataNonOrdered.push({
        libPackageName,
        libPackagePath,
        libPackageJsonData: libPackageJsonData as PackageJson,
      })
    }
  }
  const { libPackagesDataOrdered } = orderLibPackagesFromDependsOnToDependent({
    libPackagesData: libPackagesDataNonOrdered,
  })
  return { libPackagesData: libPackagesDataOrdered }
}

export const isSuitableLibPackagesActual = async ({ cwd, forceAccuracy }: { cwd: string; forceAccuracy?: boolean }) => {
  const result = {
    suitableLibPackagesActual: true,
    notSuitableLibPackagesName: [] as string[],
  }
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  for (const packageName of suitablePackagesNames) {
    const { suitableLibPackageActual } = await isSuitableLibPackageActual({
      cwd,
      libPackageName: packageName,
      forceAccuracy,
    })
    if (!suitableLibPackageActual) {
      result.suitableLibPackagesActual = false
      result.notSuitableLibPackagesName.push(packageName)
    }
  }
  return result
}

export const createDirIfNotExists = async ({ cwd }: { cwd: string }) => {
  const { dirExists } = await isDirExists({ cwd })
  if (!dirExists) {
    await createDir({ cwd })
  }
}

export const isGitRepo = async ({ cwd }: { cwd: string }) => {
  try {
    await exec({ cwd, command: `git status --porcelain` })
    return { gitRepo: true }
  } catch {
    return { gitRepo: false }
  }
}

export const isCommitable = async ({ cwd }: { cwd: string }) => {
  const out = await exec({ cwd, command: `git status --porcelain` })
  return {
    commitable: Boolean(out.trim()),
    commitableText: out.trim(),
  }
}

export const isMasterBaranch = async ({ cwd }: { cwd: string }) => {
  const out = await exec({ cwd, command: `git -c color.status=always branch --show-current` })
  return {
    masterBaranch: out.trim() === 'master',
    currentBranch: out.trim(),
  }
}

export const throwIfNotMasterBaranch = async ({ cwd }: { cwd: string }) => {
  const { masterBaranch, currentBranch } = await isMasterBaranch({ cwd })
  if (!masterBaranch) {
    throw new Error(`${cwd}: not on master branch (${currentBranch})`)
  }
}
