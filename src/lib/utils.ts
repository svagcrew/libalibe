import { getConfig } from '@/lib/config.js'
import fs from 'fs/promises'
import _ from 'lodash'
import semver from 'semver'
import { createDir, exec, getAllPackageJsonPaths, getPackageJson, isDirExists, jsonStringify } from 'svag-cli-utils'
import type { PackageJson } from 'type-fest'

export type PackageJsonDataLibalibe =
  | {
      ignoreSelfVersionAccuracy?: boolean
      ignoreDependeciesVersionAccuracy?: string[]
    }
  | undefined
export type RootLibPackageData = {
  rootLibPackageName: string
  rootLibPackagePath: string
  rootLibPackageJsonData: PackageJson
}
export type RootLibPackageDataExtended = RootLibPackageData & {
  dependency: boolean
  circular: boolean
}

export const getSuitableLibPackages = async ({ cwd }: { cwd: string }) => {
  const { packageJsonData: projectPackageJsonData } = await getPackageJson({ cwd })
  const { packageJsonsPublicable } = await getAllLibPackageJsonsPublicable({ cwd })
  const libPackagesNames = packageJsonsPublicable
    .map(({ packageJsonData }) => packageJsonData.name)
    .filter(Boolean) as string[]
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

export const getRootLibPackagePath = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { config } = await getConfig({ cwd })
  const libPackagePath = config.items[libPackageName]
  if (!libPackagePath) {
    throw new Error(`Invalid lib package name: "${libPackageName}"`)
  }
  return { libPackagePath }
}

export const getRootLibPackagesPaths = async ({
  cwd,
  libPackagesNames,
}: {
  cwd: string
  libPackagesNames: string[]
}) => {
  const libPackagesPaths = await Promise.all(
    libPackagesNames.map(async (libPackageName) => {
      const { libPackagePath } = await getRootLibPackagePath({ cwd, libPackageName })
      return libPackagePath
    })
  )
  return { libPackagesPaths }
}

export const getPublicableLibPackagesPaths = async ({
  cwd,
  libPackagesNames,
}: {
  cwd: string
  libPackagesNames: string[]
}) => {
  const { packageJsonsPublicable } = await getAllLibPackageJsonsPublicable({ cwd })
  const libPackagesPaths: string[] = []
  for (const { packageJsonPath, packageJsonDir } of packageJsonsPublicable) {
    const { packageJsonData } = await getPackageJson({ packageJsonPath })
    if (packageJsonData.name && libPackagesNames.includes(packageJsonData.name)) {
      libPackagesPaths.push(packageJsonDir)
    }
  }
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
  const { libPackagePath } = await getRootLibPackagePath({ cwd, libPackageName })
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
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  const rootLibPackageData = rootLibPackagesData.find((pkg) => pkg.rootLibPackageName === libPackageName)
  if (!rootLibPackageData) {
    throw new Error(`${cwd}: lib package data not found "${libPackageName}"`)
  }
  const circular = await isRootLibPackageCircularDependency({
    rootLibPackageData,
    rootLibPackagesData,
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
    ...thatLibPackageJsonData.peerDependencies,
    ...thatLibPackageJsonData.devDependencies,
    ...thatLibPackageJsonData.dependencies,
  }
  const thisLibPackageName = thisLibPackageJsonData.name
  const existsInDepsExact = !!thisLibPackageName && !!thatLibPackageJsonDataDeps[thisLibPackageName]
  const existsInDepsLike =
    !!thisLibPackageName &&
    !!Object.keys(thatLibPackageJsonDataDeps).some((depName) => depName.startsWith(`@${thisLibPackageName}/`))
  return {
    thisLibPackageDependencyOfThatLibPackage: existsInDepsExact || existsInDepsLike,
  }
}

const isThisRootLibPackageDependencyOfThatRootLibPackage = async ({
  thisRootLibPackageJsonDir,
  thatRootLibPackageJsonDir,
}: {
  thisRootLibPackageJsonDir: string
  thatRootLibPackageJsonDir: string
}) => {
  const { packageJsonsPublicable: thisRootLibPackageJsonsPublicable } = await getAllPackageJsonsPublicable({
    cwd: thisRootLibPackageJsonDir,
  })
  const { packageJsonsPublicable: thatRootLibPackageJsonsPublicable } = await getAllPackageJsonsPublicable({
    cwd: thatRootLibPackageJsonDir,
  })
  for (const { packageJsonData: thisLibPackageJsonDataPublicable } of thisRootLibPackageJsonsPublicable) {
    for (const { packageJsonData: thatLibPackageJsonDataPublicable } of thatRootLibPackageJsonsPublicable) {
      const { thisLibPackageDependencyOfThatLibPackage } = isThisLibPackageDependencyOfThatLibPackage({
        thisLibPackageJsonData: thisLibPackageJsonDataPublicable,
        thatLibPackageJsonData: thatLibPackageJsonDataPublicable,
      })
      if (thisLibPackageDependencyOfThatLibPackage) {
        return { thisRootLibPackageDependencyOfThatRootLibPackage: true }
      }
    }
  }
  return { thisRootLibPackageDependencyOfThatRootLibPackage: false }
}

const isThisLibPackageDependsOnThatLibPackage = ({
  thisLibPackageJsonData,
  thatLibPackageJsonData,
}: {
  thisLibPackageJsonData: PackageJson
  thatLibPackageJsonData: PackageJson
}) => {
  const thisLibPackageJsonDataDeps = {
    ...thisLibPackageJsonData.peerDependencies,
    ...thisLibPackageJsonData.devDependencies,
    ...thisLibPackageJsonData.dependencies,
  }
  const thatLibPackageName = thatLibPackageJsonData.name
  const existsInDepsExact = !!thatLibPackageName && !!thisLibPackageJsonDataDeps[thatLibPackageName]
  const existsInDepsLike =
    !!thatLibPackageName &&
    !!Object.keys(thisLibPackageJsonDataDeps).some((depName) => depName.startsWith(`@${thatLibPackageName}/`))
  return {
    thisLibPackageDependsOnThatLibPackage: existsInDepsExact || existsInDepsLike,
  }
}

const isThisRootLibPackageDependsOnThatRootLibPackage = async ({
  thisRootLibPackageJsonDir,
  thatRootLibPackageJsonDir,
}: {
  thisRootLibPackageJsonDir: string
  thatRootLibPackageJsonDir: string
}) => {
  const { packageJsonsPublicable: thisRootLibPackageJsonsPublicable } = await getAllPackageJsonsPublicable({
    cwd: thisRootLibPackageJsonDir,
  })
  const { packageJsonsPublicable: thatRootLibPackageJsonsPublicable } = await getAllPackageJsonsPublicable({
    cwd: thatRootLibPackageJsonDir,
  })
  for (const { packageJsonData: thisLibPackageJsonDataPublicable } of thisRootLibPackageJsonsPublicable) {
    for (const { packageJsonData: thatLibPackageJsonDataPublicable } of thatRootLibPackageJsonsPublicable) {
      const { thisLibPackageDependsOnThatLibPackage } = isThisLibPackageDependsOnThatLibPackage({
        thisLibPackageJsonData: thisLibPackageJsonDataPublicable,
        thatLibPackageJsonData: thatLibPackageJsonDataPublicable,
      })
      if (thisLibPackageDependsOnThatLibPackage) {
        return { thisRootLibPackageDependsOnThatRootLibPackage: true }
      }
    }
  }
  return { thisRootLibPackageDependsOnThatRootLibPackage: false }
}

// const isLibPackageDependencyOfAnother = ({
//   libPackageData,
//   libPackagesData,
// }: {
//   libPackageData: LibPackageData
//   libPackagesData: LibPackageData[]
// }) => {
//   const dependencies = libPackagesData.filter(
//     (pkg) =>
//       isThisLibPackageDependencyOfThatLibPackage({
//         thisLibPackageJsonData: libPackageData.libPackageJsonData,
//         thatLibPackageJsonData: pkg.libPackageJsonData,
//       }).thisLibPackageDependencyOfThatLibPackage && pkg.libPackageName !== libPackageData.libPackageName
//   )
//   return dependencies.length > 0
// }

const isRootLibPackageDependencyOfAnother = async ({
  rootLibPackageData,
  rootLibPackagesData,
}: {
  rootLibPackageData: RootLibPackageData
  rootLibPackagesData: RootLibPackageData[]
}) => {
  let dependenciesCount = 0
  for (const pkg of rootLibPackagesData) {
    if (pkg.rootLibPackageName === rootLibPackageData.rootLibPackageName) {
      continue
    }
    const { thisRootLibPackageDependencyOfThatRootLibPackage } =
      await isThisRootLibPackageDependencyOfThatRootLibPackage({
        thisRootLibPackageJsonDir: rootLibPackageData.rootLibPackagePath,
        thatRootLibPackageJsonDir: pkg.rootLibPackagePath,
      })
    if (thisRootLibPackageDependencyOfThatRootLibPackage) {
      dependenciesCount++
    }
  }
  return dependenciesCount > 0
}

// const isLibPackageCircularDependency = ({
//   libPackageData,
//   libPackagesData,
// }: {
//   libPackageData: LibPackageData
//   libPackagesData: LibPackageData[]
// }) => {
//   const visited = new Set<number>()
//   const onStack = new Set<number>()
//   let hasCycle = false

//   const visit = (nodeIndex: number) => {
//     if (onStack.has(nodeIndex)) {
//       hasCycle = true
//       return // Cycle detected
//     }
//     if (visited.has(nodeIndex)) {
//       return // Already processed
//     }
//     visited.add(nodeIndex)
//     onStack.add(nodeIndex)

//     const currentNode = libPackagesData[nodeIndex]
//     const dependencies = libPackagesData.filter(
//       (pkg, idx) =>
//         idx !== nodeIndex &&
//         isThisLibPackageDependencyOfThatLibPackage({
//           thisLibPackageJsonData: currentNode.libPackageJsonData,
//           thatLibPackageJsonData: pkg.libPackageJsonData,
//         }).thisLibPackageDependencyOfThatLibPackage
//     )

//     for (const dep of dependencies) {
//       const depIndex = libPackagesData.indexOf(dep)
//       visit(depIndex)
//       if (hasCycle) {
//         continue
//       }
//     }

//     onStack.delete(nodeIndex)
//   }

//   const nodeIndexOutside = libPackagesData.indexOf(libPackageData)
//   if (nodeIndexOutside > -1) {
//     visit(nodeIndexOutside)
//   }
//   return hasCycle
// }

const isRootLibPackageCircularDependency = async ({
  rootLibPackageData,
  rootLibPackagesData,
}: {
  rootLibPackageData: RootLibPackageData
  rootLibPackagesData: RootLibPackageData[]
}) => {
  const visited = new Set<number>()
  const onStack = new Set<number>()
  let hasCycle = false

  const visit = async (nodeIndex: number) => {
    if (onStack.has(nodeIndex)) {
      hasCycle = true
      return // Cycle detected
    }
    if (visited.has(nodeIndex)) {
      return // Already processed
    }
    visited.add(nodeIndex)
    onStack.add(nodeIndex)

    const currentNode = rootLibPackagesData[nodeIndex]
    const dependencies: RootLibPackageData[] = []
    for (const [idx, pkg] of rootLibPackagesData.entries()) {
      if (idx === nodeIndex) {
        continue
      }
      const { thisRootLibPackageDependencyOfThatRootLibPackage } =
        await isThisRootLibPackageDependencyOfThatRootLibPackage({
          thisRootLibPackageJsonDir: currentNode.rootLibPackagePath,
          thatRootLibPackageJsonDir: pkg.rootLibPackagePath,
        })
      if (thisRootLibPackageDependencyOfThatRootLibPackage) {
        dependencies.push(pkg)
      }
    }

    for (const dep of dependencies) {
      const depIndex = rootLibPackagesData.indexOf(dep)
      await visit(depIndex)
      if (hasCycle) {
        continue
      }
    }

    onStack.delete(nodeIndex)
  }

  const nodeIndexOutside = rootLibPackagesData.indexOf(rootLibPackageData)
  if (nodeIndexOutside > -1) {
    await visit(nodeIndexOutside)
  }
  return hasCycle
}

export const orderRootLibPackagesFromDependsOnToDependent = async ({
  rootLibPackagesData,
}: {
  rootLibPackagesData: RootLibPackageData[]
}) => {
  const rootLibPackagesDataExtended = _.cloneDeep(rootLibPackagesData).map((libPackageData) => ({
    ...libPackageData,
    dependency: false,
    circular: false,
  })) as RootLibPackageDataExtended[]

  // TODO: check if this is correct
  const getOrderString = (rootLibPackagesDataInside: RootLibPackageData[]) => {
    return rootLibPackagesDataInside.map(({ rootLibPackageName }) => rootLibPackageName).join('|')
  }
  const knownOrders = [getOrderString(rootLibPackagesDataExtended)]
  for (let i = 0; i < rootLibPackagesDataExtended.length; i++) {
    for (let j = i + 1; j < rootLibPackagesDataExtended.length; j++) {
      const { thisRootLibPackageDependsOnThatRootLibPackage } = await isThisRootLibPackageDependsOnThatRootLibPackage({
        thisRootLibPackageJsonDir: rootLibPackagesDataExtended[i].rootLibPackagePath,
        thatRootLibPackageJsonDir: rootLibPackagesDataExtended[j].rootLibPackagePath,
      })
      if (thisRootLibPackageDependsOnThatRootLibPackage) {
        const rootLibPackageData = rootLibPackagesDataExtended.splice(j, 1)[0]
        rootLibPackageData.dependency = true
        rootLibPackagesDataExtended.splice(i, 0, rootLibPackageData)
        if (!knownOrders.includes(getOrderString(rootLibPackagesDataExtended))) {
          i--
          knownOrders.push(getOrderString(rootLibPackagesDataExtended))
        }
        break
      }
    }
  }

  for (const rootLibPackageDataExtended of rootLibPackagesDataExtended) {
    rootLibPackageDataExtended.dependency = await isRootLibPackageDependencyOfAnother({
      rootLibPackageData: rootLibPackageDataExtended,
      rootLibPackagesData: rootLibPackagesDataExtended,
    })
    rootLibPackageDataExtended.circular = await isRootLibPackageCircularDependency({
      rootLibPackageData: rootLibPackageDataExtended,
      rootLibPackagesData: rootLibPackagesDataExtended,
    })
  }

  const rootLibPackagesDataExtendedOrdered = _.orderBy(
    rootLibPackagesDataExtended,
    ['dependency', 'circular'],
    ['desc', 'desc']
  )

  return { rootLibPackagesDataOrdered: rootLibPackagesDataExtendedOrdered }
}

export const getOrderedRootLibPackagesData = async ({
  cwd,
  include,
  exclude,
}: {
  cwd: string
  include?: string[]
  exclude?: string[]
}) => {
  const { config } = await getConfig({ cwd })
  const rootLibPackagesDataNonOrdered: RootLibPackageData[] = []
  for (const [rootLibPackageName, rootLibPackagePath] of Object.entries(config.items)) {
    const { packageJsonData: rootLibPackageJsonData } = await getPackageJson({ cwd: rootLibPackagePath })
    const existsInInclude = !include || include.includes(rootLibPackageName)
    const notExistsInExclude = !exclude?.includes(rootLibPackageName)
    if (existsInInclude && notExistsInExclude) {
      rootLibPackagesDataNonOrdered.push({
        rootLibPackageName,
        rootLibPackagePath,
        rootLibPackageJsonData: rootLibPackageJsonData as PackageJson,
      })
    }
  }
  const { rootLibPackagesDataOrdered } = await orderRootLibPackagesFromDependsOnToDependent({
    rootLibPackagesData: rootLibPackagesDataNonOrdered,
  })
  return { rootLibPackagesData: rootLibPackagesDataOrdered }
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
    mainBaranch: out.trim() === 'main',
    currentBranch: out.trim(),
  }
}

export const throwIfNotMasterBaranch = async ({ cwd }: { cwd: string }) => {
  const { mainBaranch, currentBranch } = await isMasterBaranch({ cwd })
  if (!mainBaranch) {
    throw new Error(`${cwd}: not on main branch (${currentBranch})`)
  }
}

export const updatePackageJson = async ({
  packageJsonPath,
  version,
}: {
  packageJsonPath: string
  version: string
}): Promise<{
  packageJsonData: PackageJson
}> => {
  const { packageJsonData } = await getPackageJson({ packageJsonPath })
  packageJsonData.version = version
  const packageJsonString = jsonStringify({
    data: packageJsonData,
    order: [
      'name',
      'version',
      'homepage',
      'repository',
      'bugs',
      'author',
      'license',
      'private',
      'publishConfig',
      'module',
      'main',
      'bin',
      'files',
      'scripts',
      'peerDependencies',
      'dependencies',
      'devDependencies',
      'libalibe',
    ],
  })
  await fs.writeFile(packageJsonPath, packageJsonString)
  return {
    packageJsonData,
  }
}

export const updatePackageJsonVersion = async ({
  packageJsonPath,
  version,
}: {
  packageJsonPath: string
  version: 'major' | 'minor' | 'patch' | string
}): Promise<{
  packageJsonData: PackageJson
  newVersion: string
}> => {
  const { packageJsonData } = await getPackageJson({ packageJsonPath })
  const newVersion = (() => {
    if (version !== 'major' && version !== 'minor' && version !== 'patch') {
      return version
    }
    if (!packageJsonData.version) {
      return '0.1.0'
    }
    const newVersion = semver.inc(packageJsonData.version, version)
    if (!newVersion) {
      throw new Error(`Invalid version: ${version}, ${newVersion}`)
    }
    return newVersion
  })()

  const { packageJsonData: packageJsonDataUpdated } = await updatePackageJson({
    packageJsonPath,
    version: newVersion,
  })
  return { packageJsonData: packageJsonDataUpdated, newVersion }
}

const memoizeAsync = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache: { [key: string]: ReturnType<T> } = {}
  return function (...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args)
    if (!(key in cache)) {
      cache[key] = fn(...args)
    }
    return cache[key]
  } as T
}

export const getAllPackageJsonsPublicable = memoizeAsync(async ({ cwd }: { cwd: string }) => {
  const { allPackageJsonsPathsAndDirs } = await getAllPackageJsonPaths({ cwd })
  const packageJsonsPublicable: Array<{
    packageJsonPath: string
    packageJsonDir: string
    packageJsonData: PackageJson
  }> = []
  for (const { packageJsonPath, packageJsonDir } of allPackageJsonsPathsAndDirs) {
    const { packageJsonData } = await getPackageJson({ packageJsonPath })
    if (!packageJsonData.private) {
      packageJsonsPublicable.push({ packageJsonPath, packageJsonDir, packageJsonData })
    }
  }
  return { packageJsonsPublicable }
})

export const getAllLibPackageJsonsPublicable = memoizeAsync(async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ cwd })
  const libPackagePaths = Object.values(config.items)
  const packageJsonsPublicable: Array<{
    packageJsonPath: string
    packageJsonDir: string
    packageJsonData: PackageJson
  }> = []
  for (const libPackagePath of libPackagePaths) {
    const { packageJsonsPublicable: packageJsonsPublicableHere } = await getAllPackageJsonsPublicable({
      cwd: libPackagePath,
    })
    packageJsonsPublicable.push(...packageJsonsPublicableHere)
  }
  return { packageJsonsPublicable }
})
