import child_process from 'child_process'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeData = <T>(data: T): T => {
  return data
  // const dataString = data.toString()
  // if (dataString.match(/^\n*$/)) {
  //   return ''
  // }
  // return dataString.replace(/\n{2,}/g, '\n')
}

export const exec = async ({
  cwd,
  command,
  verbose = false,
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
          // console.error(stderr)
          process.stderr.write(stderr)
        }
        return reject(stderr)
      }
      if (verbose) {
        console.log(stdout)
        process.stdout.write(stdout)
      }
      return resolve(stdout)
    })
  })
}

export const spawn = async ({
  cwd,
  command,
  verbose = true,
  env = {},
}: {
  cwd: string
  command: string
  verbose?: boolean
  env?: Record<string, string>
}): Promise<string> => {
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
    const child = child_process.spawn(commandSelf, commandArgs, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => {
      const normalizedData = normalizeData(data)
      if (!normalizedData) {
        return
      }
      stdout += normalizedData
      if (verbose) {
        process.stdout.write(normalizedData)
      }
    })
    child.stderr.on('data', (data) => {
      const normalizedData = normalizeData(data)
      if (!normalizedData) {
        return
      }
      stderr += normalizedData
      if (verbose) {
        process.stderr.write(normalizedData)
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
