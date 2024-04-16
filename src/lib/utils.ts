import fg from 'fast-glob'
import { promises as fs } from 'fs'
import yaml from 'js-yaml'
import _ from 'lodash'
import path from 'path'
import pc from 'picocolors'
import semver from 'semver'
import { getConfig } from './config'
import { exec, spawn } from './exec'

export type PackageJsonData = {
  name: string
  version: string
  devDependencies?: Record<string, string>
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
  repository: {
    url: string
  }
  libalibe?: {
    selfVersionAccuracyNotMatter?: boolean
    depsVersionAccuracyNotMatter?: string[]
  }
}
export type LibPackageData = { libPackageName: string; libPackagePath: string; libPackageJsonData: PackageJsonData }

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
  const { packageJsonData: projectPackageJsonData } = await getPackageJsonData({ dirPath: cwd })
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
  if (
    projectPackageJsonData.libalibe?.depsVersionAccuracyNotMatter?.includes(libPackageName) ||
    !!libPackageJsonData.libalibe?.selfVersionAccuracyNotMatter
  ) {
    return { suitableLibPackageActual: semver.satisfies(libPackageJsonData.version, projectLibPackageVersionRaw) }
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

export const isDirExists = async ({ cwd }: { cwd: string }) => {
  try {
    await fs.access(cwd)
    return { dirExists: true }
  } catch (error) {
    return { dirExists: false }
  }
}

export const isDirEmpty = async ({ cwd }: { cwd: string }) => {
  const files = await fs.readdir(cwd)
  return { dirEmpty: !files.length }
}

export const createDir = async ({ cwd }: { cwd: string }) => {
  await fs.mkdir(cwd, { recursive: true })
}

export const createDirIfNotExists = async ({ cwd }: { cwd: string }) => {
  const { dirExists } = await isDirExists({ cwd })
  if (!dirExists) {
    await createDir({ cwd })
  }
}

export const isGitRepo = async ({ cwd }: { cwd: string }) => {
  try {
    await spawn({ cwd, command: `git status --porcelain`, verbose: false })
    return { gitRepo: true }
  } catch (error) {
    return { gitRepo: false }
  }
}

export const isCommitable = async ({ cwd }: { cwd: string }) => {
  const out = await spawn({ cwd, command: `git status --porcelain`, verbose: false })
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

const logColored = ({
  message,
  color,
}: {
  message: string | string[]
  color: 'red' | 'blue' | 'green' | 'gray' | 'black'
}) => {
  const messages = Array.isArray(message) ? message : [message]
  // eslint-disable-next-line no-console
  console.log(pc[color](messages.join('\n')))
}

const logMemory: Record<string, string[]> = {
  default: [],
}
export const logToMemeoryColored = ({
  message,
  color,
  memoryKey = 'default',
}: {
  message: string | string[]
  color: 'red' | 'blue' | 'green' | 'gray' | 'black'
  memoryKey?: string
}) => {
  const messages = (Array.isArray(message) ? message : [message]).map((message) => pc[color](message))
  logMemory[memoryKey] = [...logMemory[memoryKey], ...messages]
}

export const log = {
  it: logColored,
  red: (...message: string[]) => logColored({ message, color: 'red' }),
  blue: (...message: string[]) => logColored({ message, color: 'blue' }),
  green: (...message: string[]) => logColored({ message, color: 'green' }),
  gray: (...message: string[]) => logColored({ message, color: 'gray' }),
  black: (...message: string[]) => logColored({ message, color: 'black' }),
  // eslint-disable-next-line no-console
  error: console.error,
  // eslint-disable-next-line no-console
  info: console.info,
  toMemory: {
    it: logToMemeoryColored,
    red: (...message: string[]) => logToMemeoryColored({ message, color: 'red' }),
    blue: (...message: string[]) => logToMemeoryColored({ message, color: 'blue' }),
    green: (...message: string[]) => logToMemeoryColored({ message, color: 'green' }),
    gray: (...message: string[]) => logToMemeoryColored({ message, color: 'gray' }),
    black: (...message: string[]) => logToMemeoryColored({ message, color: 'black' }),
  },
  fromMemory: (memoryKey = 'default') => {
    for (const message of logMemory[memoryKey] || []) {
      // eslint-disable-next-line no-console
      console.log(message)
    }
  },
  isMemoryNotEmpty: (memoryKey = 'default') => {
    return !!(logMemory[memoryKey]?.length > 0)
  },
}
