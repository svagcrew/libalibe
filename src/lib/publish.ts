import { exec, spawn } from './utils'

export const bumpPushPublish = async ({ cwd, bump = 'patch' }: { cwd: string; bump?: 'patch' | 'major' | 'minor' }) => {
  await spawn({ cwd, command: `pnpm version ${bump}` })
  await spawn({ cwd, command: `git push origin master` })
  await spawn({ cwd, command: `pnpm publish` })
}

export const commitBumpPushPublish = async ({ cwd, message }: { cwd: string; message: string }) => {
  await spawn({ cwd, command: `git add -A` })
  await spawn({ cwd, command: `git commit -m "${message}"` })
  await bumpPushPublish({ cwd })
}
