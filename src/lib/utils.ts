import fg from 'fast-glob'
import { promises as fs } from 'fs'
import yaml from 'js-yaml'
import path from 'path'
import semver from 'semver'
import { getConfig } from './config'

export type PackageJsonData = {
  name: string
  version: string
  devDependencies?: Record<string, string>
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
}
type LibPackageData = { libPackageName: string; libPackagePath: string; libPackageJsonData: PackageJsonData }

export const getPathsByGlobs = async ({ globs, baseDir }: { globs: string[]; baseDir: string }) => {
  const filePaths = await fg(globs, {
    cwd: baseDir,
    onlyFiles: true,
    absolute: true,
  })
  return { filePaths }
}

export const getDataFromFile = async ({ filePath }: { filePath: string }) => {
  const ext = path.basename(filePath).split('.').pop()
  if (ext === 'js' || ext === 'ts') {
    return require(filePath)
  }
  if (ext === 'yml' || ext === 'yaml') {
    return yaml.load(await fs.readFile(filePath, 'utf8'))
  }
  if (ext === 'json') {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  }
  throw new Error(`Unsupported file extension: ${ext}`)
}

export const stringsToLikeArrayString = (paths: string[]) => {
  return paths.map((path) => `"${path}"`).join(', ')
}

export const fulfillDistPath = ({ distPath, distLang }: { distPath: string; distLang: string }) => {
  return distPath.replace(/\$lang/g, distLang)
}

export const getPackageJsonData = async ({ dirPath }: { dirPath: string }) => {
  let dirPathHere = path.resolve('/', dirPath)
  for (let i = 0; i < 777; i++) {
    const maybePackageJsonGlobs = [`${dirPathHere}/package.json`]
    const maybePackageJsonPath = (
      await fg(maybePackageJsonGlobs, {
        onlyFiles: true,
        absolute: true,
      })
    )[0]
    if (maybePackageJsonPath) {
      const packageJsonData: PackageJsonData = await getDataFromFile({
        filePath: maybePackageJsonPath,
      })
      return { packageJsonData }
    }
    const parentDirPath = path.resolve(dirPathHere, '..')
    if (dirPathHere === parentDirPath) {
      throw new Error('package.json not found')
    }
    dirPathHere = parentDirPath
  }
  throw new Error('package.json not found')
}

export const getSuitableLibPackages = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ dirPath: cwd })
  const { packageJsonData: projectPackageJsonData } = await getPackageJsonData({ dirPath: cwd })
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
  const { config } = await getConfig({ dirPath: cwd })
  const libPackagePath = config.items[libPackageName]
  if (!libPackagePath) {
    throw new Error(`Invalid lib package name: "${libPackageName}"`)
  }
  return { libPackagePath }
}

export const getLibPackageJsonData = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { libPackagePath } = await getLibPackagePath({ cwd, libPackageName })
  const { packageJsonData: libPackageJsonData } = await getPackageJsonData({ dirPath: libPackagePath })
  return { libPackageJsonData }
}

export const isSuitableLibPackageActual = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { suitablePackagesWithVersion } = await getSuitableLibPackages({
    cwd,
  })
  const projectLibPackageVersionRaw = suitablePackagesWithVersion[libPackageName]
  const projectLibPackageVersionMin = semver.minVersion(projectLibPackageVersionRaw)
  const { libPackageJsonData } = await getLibPackageJsonData({ cwd, libPackageName })
  if (!projectLibPackageVersionMin) {
    return { suitableLibPackageActual: false }
  }
  if (!libPackageJsonData.version) {
    return { suitableLibPackageActual: false }
  }
  return {
    suitableLibPackageActual: semver.eq(projectLibPackageVersionMin, libPackageJsonData.version),
  }
}

const isThisLibPackageDependsOnThatLibPackage = ({
  thisLibPackageJsonData,
  thatLibPackageJsonData,
}: {
  thisLibPackageJsonData: PackageJsonData
  thatLibPackageJsonData: PackageJsonData
}) => {
  const thisLibPackageJsonDataDeps = {
    ...thisLibPackageJsonData.devDependencies,
    ...thisLibPackageJsonData.dependencies,
  }
  const thatLibPackageName = thatLibPackageJsonData.name
  return { thisLibPackageDependsOnThatLibPackage: !!thisLibPackageJsonDataDeps[thatLibPackageName] }
}

const orderLibPackagesFromDependsOnToDependent = ({ libPackagesData }: { libPackagesData: LibPackageData[] }) => {
  const libPackagesDataOrdered: LibPackageData[] = []
  for (const libPackageData of libPackagesData) {
    libPackagesDataOrdered.push(libPackageData)
  }
  for (let i = 0; i < libPackagesDataOrdered.length; i++) {
    for (let j = i + 1; j < libPackagesDataOrdered.length; j++) {
      const { thisLibPackageDependsOnThatLibPackage } = isThisLibPackageDependsOnThatLibPackage({
        thisLibPackageJsonData: libPackagesDataOrdered[i].libPackageJsonData,
        thatLibPackageJsonData: libPackagesDataOrdered[j].libPackageJsonData,
      })
      if (thisLibPackageDependsOnThatLibPackage) {
        const libPackageData = libPackagesDataOrdered.splice(j, 1)[0]
        libPackagesDataOrdered.splice(i, 0, libPackageData)
        i--
        break
      }
    }
  }
  return { libPackagesDataOrdered }
}

export const getOrderedLibPackagesData = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ dirPath: cwd })
  const libPackagesDataNonOrdered: LibPackageData[] = []
  for (const [libPackageName, libPackagePath] of Object.entries(config.items)) {
    const { packageJsonData: libPackageJsonData } = await getPackageJsonData({ dirPath: libPackagePath })
    libPackagesDataNonOrdered.push({ libPackageName, libPackagePath, libPackageJsonData })
  }
  const { libPackagesDataOrdered } = orderLibPackagesFromDependsOnToDependent({
    libPackagesData: libPackagesDataNonOrdered,
  })
  return { libPackagesData: libPackagesDataOrdered }
}

export const isSuitableLibPackagesActual = async ({ cwd }: { cwd: string }) => {
  const { suitablePackagesNames } = await getSuitableLibPackages({ cwd })
  for (const packageName of suitablePackagesNames) {
    const { suitableLibPackageActual } = await isSuitableLibPackageActual({ cwd, libPackageName: packageName })
    if (!suitableLibPackageActual) {
      return { suitableLibPackagesActual: false }
    }
  }
  return { suitableLibPackagesActual: true }
}
