import _ from 'lodash'
import pc from 'picocolors'
import semver from 'semver'
import { createDir, exec, getPackageJson, isDirExists } from 'svag-cli-utils'
import { PackageJson } from 'type-fest'
import { getConfig } from './config'

export type PackageJsonDataLibalibe =
  | {
      selfVersionAccuracyNotMatter?: boolean
      depsVersionAccuracyNotMatter?: string[]
    }
  | undefined
export type LibPackageData = { libPackageName: string; libPackagePath: string; libPackageJsonData: PackageJson }

export const getSuitableLibPackages = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ cwd })
  const { packageJsonData: projectPackageJsonData } = await getPackageJson({ cwd })
  const include = config.include
  const exclude = config.exclude
  const libPackagesNames = include.filter((include) => !exclude.includes(include))
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
      ...(projectPackageJsonData.devDependencies || {}),
      ...(projectPackageJsonData.dependencies || {}),
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

export const getLibPackageJsonData = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { libPackagePath } = await getLibPackagePath({ cwd, libPackageName })
  const { packageJsonData: libPackageJsonData } = await getPackageJson({ cwd: libPackagePath })
  return { libPackageJsonData }
}

export const isSuitableLibPackageActual = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { packageJsonData: projectPackageJsonData } = await getPackageJson({ cwd })
  const { suitablePackagesWithVersion } = await getSuitableLibPackages({
    cwd,
  })
  const projectLibPackageVersionRaw = suitablePackagesWithVersion[libPackageName]
  if (!projectLibPackageVersionRaw) {
    throw new Error(`${cwd}: version not found "${libPackageName}"`)
  }
  // TODO:ASAP get execat not min
  const projectLibPackageVersionExact = projectLibPackageVersionRaw.match(/(\d+\.\d+\.\d+)/)?.[0]
  const { libPackageJsonData } = await getLibPackageJsonData({ cwd, libPackageName })
  if (!projectLibPackageVersionExact) {
    return { suitableLibPackageActual: false }
  }
  if (!libPackageJsonData.version) {
    return { suitableLibPackageActual: false }
  }
  const projectPackageJsonDataLibalibe = projectPackageJsonData.libalibe as PackageJsonDataLibalibe
  const libPackageJsonDataLibalibe = libPackageJsonData.libalibe as PackageJsonDataLibalibe
  if (
    projectPackageJsonDataLibalibe?.depsVersionAccuracyNotMatter?.includes(libPackageName) ||
    libPackageJsonDataLibalibe?.selfVersionAccuracyNotMatter
  ) {
    return { suitableLibPackageActual: semver.satisfies(libPackageJsonData.version, projectLibPackageVersionRaw) }
  }
  return {
    suitableLibPackageActual: semver.eq(projectLibPackageVersionExact, libPackageJsonData.version),
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

const orderLibPackagesFromDependsOnToDependent = ({ libPackagesData }: { libPackagesData: LibPackageData[] }) => {
  const libPackagesDataOrdered = _.cloneDeep(libPackagesData)
  const getOrderString = (libPackagesData: LibPackageData[]) => {
    return libPackagesData.map(({ libPackageName }) => libPackageName).join('|')
  }
  const knownOrders = [getOrderString(libPackagesDataOrdered)]
  for (let i = 0; i < libPackagesDataOrdered.length; i++) {
    for (let j = i + 1; j < libPackagesDataOrdered.length; j++) {
      const { thisLibPackageDependsOnThatLibPackage } = isThisLibPackageDependsOnThatLibPackage({
        thisLibPackageJsonData: libPackagesDataOrdered[i].libPackageJsonData,
        thatLibPackageJsonData: libPackagesDataOrdered[j].libPackageJsonData,
      })
      if (thisLibPackageDependsOnThatLibPackage) {
        const libPackageData = libPackagesDataOrdered.splice(j, 1)[0]
        libPackagesDataOrdered.splice(i, 0, libPackageData)
        if (!knownOrders.includes(getOrderString(libPackagesDataOrdered))) {
          i--
          knownOrders.push(getOrderString(libPackagesDataOrdered))
        }
        break
      }
    }
  }
  return { libPackagesDataOrdered }
}

export const getOrderedLibPackagesData = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ cwd })
  const libPackagesDataNonOrdered: LibPackageData[] = []
  for (const [libPackageName, libPackagePath] of Object.entries(config.items)) {
    const { packageJsonData: libPackageJsonData } = await getPackageJson({ cwd: libPackagePath })
    libPackagesDataNonOrdered.push({ libPackageName, libPackagePath, libPackageJsonData })
  }
  const { libPackagesDataOrdered } = orderLibPackagesFromDependsOnToDependent({
    libPackagesData: libPackagesDataNonOrdered,
  })
  return { libPackagesData: libPackagesDataOrdered }
}

export const isSuitableLibPackagesActual = async ({ cwd }: { cwd: string }) => {
  const result = {
    suitableLibPackagesActual: true,
    notSuitableLibPackagesName: [] as string[],
  }
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  for (const packageName of suitablePackagesNames) {
    const { suitableLibPackageActual } = await isSuitableLibPackageActual({ cwd, libPackageName: packageName })
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
  } catch (error) {
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
