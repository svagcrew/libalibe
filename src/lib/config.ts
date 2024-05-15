import { getEnv } from '@/lib/env'
import fg from 'fast-glob'
import fs from 'fs/promises'
import _ from 'lodash'
import path from 'path'
import { getDataFromFile, getPackageJson, stringsToLikeArrayString } from 'svag-cli-utils'
import { z } from 'zod'

const zConfigInput = z.object({
  items: z.record(z.string(), z.string()).optional().default({}),
})
export type ConfigInput = z.input<typeof zConfigInput>
export type Config = z.infer<typeof zConfigInput>
const defaultConfig: Config = {
  items: {},
}

export const findAllConfigsPaths = async ({ cwd }: { cwd: string }) => {
  const configPaths: string[] = []
  const LIBALIBE_CONFIG_PATH = getEnv('LIBALIBE_CONFIG_PATH')
  if (LIBALIBE_CONFIG_PATH) {
    configPaths.push(LIBALIBE_CONFIG_PATH)
  }
  let dirPath = path.resolve('/', cwd)
  for (let i = 0; i < 777; i++) {
    const maybeConfigGlobs = [`${dirPath}/(libalibe.|libalibe.*.)(js|mjs|ts|yml|yaml|json)`]
    const maybeConfigPath = (
      await fg(maybeConfigGlobs, {
        onlyFiles: true,
        absolute: true,
      })
    )[0]
    if (maybeConfigPath) {
      configPaths.push(maybeConfigPath)
    }
    const parentDirPath = path.resolve(dirPath, '..')
    if (dirPath === parentDirPath) {
      return { configPaths: [...new Set(configPaths)] }
    }
    dirPath = parentDirPath
  }
  return { configPaths: [...new Set(configPaths)] }
}

export const getConfig = async ({ cwd }: { cwd: string }): Promise<{ config: Config }> => {
  const { configPaths } = await findAllConfigsPaths({ cwd })
  if (configPaths.length === 0) {
    throw new Error('Config file not found')
  }
  const configMerged = _.cloneDeep(defaultConfig)
  for (const configPath of configPaths) {
    const configData = await getDataFromFile({ filePath: configPath })
    configMerged.items = { ...configMerged.items, ...configData.items }
  }
  const configMergedValidated = zConfigInput.safeParse(configMerged)
  if (!configMergedValidated.success) {
    throw new Error(`Invalid config files: "${stringsToLikeArrayString(configPaths)}"`)
  }
  return { config: configMergedValidated.data }
}

export const addItemToConfig = async ({ projectPath }: { projectPath: string }) => {
  const { configPaths } = await findAllConfigsPaths({ cwd: projectPath })
  const configPath = configPaths[0]
  const configRaw = await getDataFromFile({ filePath: configPath })
  const configValidated = zConfigInput.safeParse(configRaw)
  if (!configValidated.success) {
    throw new Error(`Invalid config file: "${configPath}"`)
  }
  const config = configValidated.data
  const { packageJsonData } = await getPackageJson({ cwd: projectPath })
  if (!packageJsonData.name) {
    throw new Error('No name in package.json')
  }
  config.items[packageJsonData.name] = projectPath
  await fs.writeFile(configPath, JSON.stringify(config, null, 2))
}
