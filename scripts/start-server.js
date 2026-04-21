const { spawn } = require("node:child_process")

function getServerStartConfig() {
  return {
    port: process.env.PORT || "3010",
    host: process.env.HOST || "0.0.0.0",
  }
}

function startServer(options = {}) {
  const { spawnImpl = spawn, registerSignalHandlers = true } = options
  const { port, host } = getServerStartConfig()

  const child = spawnImpl(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "-p", port, "-H", host],
    {
      env: process.env,
      stdio: "inherit",
    }
  )

  if (registerSignalHandlers) {
    const forwardSignal = (signal) => {
      if (!child.killed) {
        child.kill(signal)
      }
    }

    process.on("SIGINT", forwardSignal)
    process.on("SIGTERM", forwardSignal)
  }

  return child
}

if (require.main === module) {
  const child = startServer()
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

module.exports = {
  getServerStartConfig,
  startServer,
}
