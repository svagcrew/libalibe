import { getOrderedRootLibPackagesData } from '@/lib/utils.js'
import { getPackageJson, log, spawn } from 'svag-cli-utils'

export const runCommand = async ({ cwd, command, argr }: { cwd: string; command: string; argr: string[] }) => {
  await spawn({ cwd, command: `pnpm run ${command} ${argr.join(' ')}` })
}

export const isRunableCommand = async ({ cwd, command }: { cwd: string; command: string }) => {
  const { packageJsonData } = await getPackageJson({ cwd })
  return { runable: !!packageJsonData.scripts?.[command] }
}

export const runCommandIfPossible = async ({
  cwd,
  command,
  argr,
}: {
  cwd: string
  command: string
  argr: string[]
}) => {
  const { runable } = await isRunableCommand({ cwd, command })
  if (runable) {
    await runCommand({ cwd, command, argr })
    return { ran: true }
  }
  return { ran: false }
}

export const runCommandRecursive = async ({ cwd, command, argr }: { cwd: string; command: string; argr: string[] }) => {
  const { rootLibPackagesData } = await getOrderedRootLibPackagesData({ cwd })
  if (!rootLibPackagesData.length) {
    log.black('No packages found at all')
    return
  }
  let ran = false
  for (const { rootLibPackagePath } of rootLibPackagesData) {
    const { runable } = await isRunableCommand({ cwd: rootLibPackagePath, command })
    if (runable) {
      log.green(`Running ${rootLibPackagePath}`)
      await runCommand({ cwd: rootLibPackagePath, command, argr })
      log.toMemory.black(`Ran ${rootLibPackagePath}`)
      ran = true
    }
  }
  if (!ran) {
    log.black(`No packages found with a runable ${command} script`)
  }
}
