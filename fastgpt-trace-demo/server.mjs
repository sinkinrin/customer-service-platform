import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url))
const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 4173)
const FASTGPT_BASE_URL = (process.env.FASTGPT_BASE_URL || 'http://47.252.29.254:8000').replace(/\/+$/, '')
const FASTGPT_CHAT_URL = `${FASTGPT_BASE_URL}/api/v1/chat/completions`
const MAX_BODY_BYTES = 64 * 1024

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE')
    chunks.push(chunk)
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(text || '{}')
}

async function proxyFastGPT(request, response) {
  const apiKey = process.env.FASTGPT_API_KEY?.trim()
  if (!apiKey) {
    sendJson(response, 503, {
      error: 'FASTGPT_API_KEY is not configured on the demo server.',
    })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 413 : 400, {
      error: 'The request body is invalid.',
    })
    return
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message || message.length > 12_000) {
    sendJson(response, 400, { error: 'Enter a question between 1 and 12,000 characters.' })
    return
  }

  const controller = new AbortController()
  response.on('close', () => controller.abort())

  try {
    const appId = process.env.FASTGPT_APP_ID?.trim()
    const upstreamStartedAt = Date.now()
    const upstream = await fetch(FASTGPT_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        ...(appId ? { appId } : {}),
        chatId: `trace-demo-${randomUUID()}`,
        stream: true,
        detail: true,
        messages: [{ role: 'user', content: message }],
      }),
      signal: controller.signal,
    })
    const upstreamConnectMs = Date.now() - upstreamStartedAt

    if (!upstream.ok) {
      const upstreamText = await upstream.text()
      console.error(`[FastGPT] HTTP ${upstream.status}: ${upstreamText.slice(0, 500)}`)
      sendJson(response, 502, {
        error: `FastGPT returned HTTP ${upstream.status}. Check the server address and API key.`,
      })
      return
    }

    if (!upstream.body) {
      sendJson(response, 502, { error: 'FastGPT returned no response body.' })
      return
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Upstream-Status': String(upstream.status),
      'X-Upstream-Content-Type': upstream.headers.get('content-type') || '',
      'X-Upstream-Connect-Ms': String(upstreamConnectMs),
    })
    response.flushHeaders()

    // Do not stop at FastGPT's answer [DONE] marker. flowResponses, tool output,
    // and quoteList data may follow it before the upstream connection closes.
    await pipeline(Readable.fromWeb(upstream.body), response)
  } catch (error) {
    if (controller.signal.aborted) return
    console.error('[FastGPT] Proxy request failed:', error)
    if (!response.headersSent) {
      sendJson(response, 502, { error: 'Unable to connect to FastGPT.' })
    } else {
      response.end()
    }
  }
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`)
  const relativePath = requestUrl.pathname === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname.slice(1))
  const filePath = resolve(PUBLIC_DIR, relativePath)

  if (!filePath.startsWith(resolve(PUBLIC_DIR))) {
    sendJson(response, 403, { error: 'Forbidden' })
    return
  }

  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) throw new Error('NOT_FILE')
    const content = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
    })
    response.end(content)
  } catch {
    sendJson(response, 404, { error: 'Not found' })
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`)

  if (request.method === 'GET' && requestUrl.pathname === '/api/config') {
    sendJson(response, 200, {
      endpoint: FASTGPT_CHAT_URL,
      configured: Boolean(process.env.FASTGPT_API_KEY?.trim()),
    })
    return
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/chat') {
    await proxyFastGPT(request, response)
    return
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  await serveStatic(request, response)
})

server.listen(PORT, HOST, () => {
  console.log(`FastGPT Trace Demo: http://${HOST}:${PORT}`)
  console.log(`FastGPT endpoint: ${FASTGPT_CHAT_URL}`)
  console.log(`API key configured: ${process.env.FASTGPT_API_KEY ? 'yes' : 'no'}`)
})
