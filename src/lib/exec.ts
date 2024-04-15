import child_process from 'child_process'

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
}: {
  cwd: string
  command: string
  verbose?: boolean
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
    const child = child_process.spawn(commandSelf, commandArgs, { cwd })
    if (!child.stdout) {
      throw new Error('No stdout')
    }
    if (!child.stderr) {
      throw new Error('No stderr')
    }
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => {
      stdout += data
      if (verbose) {
        // console.log(data.toString())
        process.stdout.write(data)
      }
    })
    child.stderr.on('data', (data) => {
      stderr += data
      if (verbose) {
        // console.error(data.toString())
        process.stderr.write(data)
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
