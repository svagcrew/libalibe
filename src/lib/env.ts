/* eslint-disable n/no-process-env */
import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { get__dirname } from 'svag-esm'
import z from 'zod'
const __dirname = get__dirname(import.meta)

const findEnvFilePath = (dir: string, pathPart: string): string | null => {
  const maybeEnvFilePath = path.join(dir, pathPart)
  if (fs.existsSync(maybeEnvFilePath)) {
    return maybeEnvFilePath
  }
  if (dir === '/') {
    return null
  }
  return findEnvFilePath(path.dirname(dir), pathPart)
}
const envFilePath = findEnvFilePath(process.cwd(), '.env.libalibe') || findEnvFilePath(__dirname, '.env.libalibe')
if (envFilePath) {
  dotenv.config({ path: envFilePath, override: true })
  dotenv.config({ path: `${envFilePath}.${process.env.NODE_ENV}`, override: true })
}

const zEnv = z.object({
  LIBALIBE_CONFIG_PATH: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
})

type Env = z.infer<typeof zEnv>

export const envRaw = {
  LIBALIBE_CONFIG_PATH: process.env.LIBALIBE_CONFIG_PATH,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
}

export const validateEnv = () => {
  return zEnv.parse(envRaw)
}

export const getEnv = (key: keyof Env) => {
  return zEnv.parse(envRaw)[key]
}
