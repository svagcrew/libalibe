import { getEnv } from '@/lib/env'
import fg from 'fast-glob'
import _ from 'lodash'
import path from 'path'
import { getDataFromFile, stringsToLikeArrayString } from 'svag-cli-utils'
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
      return { configPaths }
    }
    dirPath = parentDirPath
  }
  return { configPaths }
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
