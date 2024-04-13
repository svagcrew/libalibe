import fg from 'fast-glob'
import _ from 'lodash'
import path from 'path'
import { z } from 'zod'
import { getDataFromFile, stringsToLikeArrayString } from './utils'

const zConfig = z.object({
  items: z.record(z.string(), z.string()).optional().default({}),
  include: z.array(z.string()).optional().default([]),
  exclude: z.array(z.string()).optional().default([]),
})
export type Config = z.infer<typeof zConfig>
const defaultConfig: Config = {
  items: {},
  include: [],
  exclude: [],
}

export const findAllConfigsPaths = async ({ dirPath }: { dirPath: string }) => {
  const configPaths: string[] = []
  let dirPathHere = path.resolve('/', dirPath)
  for (let i = 0; i < 777; i++) {
    const maybeConfigGlobs = [`${dirPathHere}/(libalibe.|libalibe.*.)(js|ts|yml|yaml|json)`]
    const maybeConfigPath = (
      await fg(maybeConfigGlobs, {
        onlyFiles: true,
        absolute: true,
      })
    )[0]
    if (maybeConfigPath) {
      configPaths.push(maybeConfigPath)
    }
    const parentDirPath = path.resolve(dirPathHere, '..')
    if (dirPathHere === parentDirPath) {
      return { configPaths: configPaths }
    }
    dirPathHere = parentDirPath
  }
  return { configPaths: configPaths }
}

export const getConfig = async ({ dirPath }: { dirPath: string }) => {
  const { configPaths } = await findAllConfigsPaths({ dirPath })
  if (configPaths.length === 0) {
    throw new Error('Config file not found')
  }
  const configMerged = _.cloneDeep(defaultConfig)
  for (const configPath of configPaths) {
    const configData = await getDataFromFile({ filePath: configPath })
    configMerged.include = [
      ...new Set([...configMerged.include, ...(Array.isArray(configData.include) ? configData.include : [])]),
    ]
    configMerged.exclude = [
      ...new Set([...configMerged.exclude, ...(Array.isArray(configData.exclude) ? configData.exclude : [])]),
    ]
    configMerged.items = { ...configMerged.items, ...configData.items }
  }
  if (!configMerged.include.length) {
    configMerged.include = Object.keys(configMerged.items)
  }
  const configMergedValidated = zConfig.safeParse(configMerged)
  if (!configMergedValidated.success) {
    throw new Error(`Invalid config files: "${stringsToLikeArrayString(configPaths)}"`)
  }
  return { config: configMergedValidated.data }
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
      const packageJsonData = await getDataFromFile({
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
