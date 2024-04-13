import child_process from 'child_process'
import fg from 'fast-glob'
import { promises as fs } from 'fs'
import yaml from 'js-yaml'
import { basename } from 'path'
import { getConfig, getPackageJsonData } from './config'

export const getPathsByGlobs = async ({ globs, baseDir }: { globs: string[]; baseDir: string }) => {
  const filePaths = await fg(globs, {
    cwd: baseDir,
    onlyFiles: true,
    absolute: true,
  })
  return { filePaths }
}

export const getDataFromFile = async ({ filePath }: { filePath: string }) => {
  const ext = basename(filePath).split('.').pop()
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

export const exec = async ({
  cwd,
  command,
  verbose = true,
}: {
  cwd: string
  command: string
  verbose?: boolean
}): Promise<string> => {
  return await new Promise((resolve, reject) => {
    child_process.exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        if (verbose) {
          console.error(error)
        }
        return reject(error)
      }
      if (stderr) {
        if (verbose) {
          console.error(stderr)
        }
        return reject(stderr)
      }
      if (verbose) {
        console.log(stdout)
      }
      return resolve(stdout)
    })
  })
}

export const spawn = async ({ cwd, command, verbose = true }: { cwd: string; command: string; verbose?: boolean }) => {
  return await new Promise((resolve, reject) => {
    // this not work. becouse one of args can be "string inside string"
    // const [commandSelf, ...commandArgs] = command.split(' ')
    const { commandSelf, commandArgs } = (() => {
      const commandParts = command.match(/(?:[^\s"]+|"[^"]*")+/g)
      if (!commandParts) {
        throw new Error('Invalid command')
      }
      return {
        commandSelf: commandParts[0],
        commandArgs: commandParts.slice(1),
      }
    })()
    if (verbose) {
      console.info(`$ ${command}`)
    }
    const child = child_process.spawn(commandSelf, commandArgs, { cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => {
      stdout += data
      if (verbose) {
        console.log(data.toString())
      }
    })
    child.stderr.on('data', (data) => {
      stderr += data
      if (verbose) {
        console.error(data.toString())
      }
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(stderr)
      }
    })
  })
}

export const getSuitableLibPackagesNames = async ({ cwd }: { cwd: string }) => {
  const { config } = await getConfig({ dirPath: cwd })
  const { packageJsonData } = await getPackageJsonData({ dirPath: cwd })
  const include = config.include
  const exclude = config.exclude
  const libPackagesNames = include.filter((include) => !exclude.includes(include))
  const devDependencies = Object.keys(packageJsonData.devDependencies || {})
  const prodDependencies = Object.keys(packageJsonData.dependencies || {})
  const allDependencies = [...new Set([...devDependencies, ...prodDependencies])]
  const suitablePackagesNames = libPackagesNames.filter((libPackageName) => allDependencies.includes(libPackageName))
  const suitableDevPackagesNames = libPackagesNames.filter((libPackageName) => devDependencies.includes(libPackageName))
  const suitableProdPackagesNames = libPackagesNames.filter((libPackageName) =>
    prodDependencies.includes(libPackageName)
  )
  const nonsuitablePackagesNames = libPackagesNames.filter(
    (libPackageName) => !allDependencies.includes(libPackageName)
  )
  return { suitablePackagesNames, suitableDevPackagesNames, suitableProdPackagesNames, nonsuitablePackagesNames }
}

export const getLibPackagePath = async ({ cwd, libPackageName }: { cwd: string; libPackageName: string }) => {
  const { config } = await getConfig({ dirPath: cwd })
  const libPackagePath = config.items[libPackageName]
  if (!libPackagePath) {
    throw new Error(`Invalid lib package name: "${libPackageName}"`)
  }
  return { libPackagePath }
}
