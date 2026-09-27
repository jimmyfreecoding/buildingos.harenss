// NetOps 后端服务（第一版，最小闭环）
//
// 现在只做一件事：把「网络健康体检」这个请求转给 DSH 容器执行，把结果返回给网页。
//
// 为什么跑在宿主机而不是容器里：
//   它需要 `docker exec` 进 DSH 容器。容器里要这么做就得挂 Docker socket
//   （等于把宿主机控制权交出去），第一版不值得。等接口多起来再考虑换成
//   容器内常驻 + 内部 HTTP 调用。
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'

const PORT = Number(process.env.PORT || 8080)
const CONTAINER = process.env.NETOPS_HARNESS_CONTAINER || 'netops-infra-harness-1'
const SCRIPT = '/opt/netops/bin/health-check.sh'
const TIMEOUT_MS = 10 * 60 * 1000

/** 同一时间只允许一次体检：容器资源有限，并发跑没有意义。 */
let inFlight = null

function runHealthCheck() {
  if (inFlight) return inFlight
  inFlight = new Promise((resolve) => {
    const started = Date.now()
    execFile(
      'docker',
      ['exec', CONTAINER, SCRIPT],
      { maxBuffer: 16 * 1024 * 1024, timeout: TIMEOUT_MS, encoding: 'utf8' },
      (error, stdout, stderr) => {
        const elapsedMs = Date.now() - started
        if (error) {
          resolve({
            ok: false,
            error: error.killed ? '体检超时' : `执行失败：${error.message}`,
            stderr: (stderr || '').slice(-4000),
            elapsedMs,
          })
          return
        }
        try {
          resolve({ ...JSON.parse(stdout), elapsedMs })
        } catch {
          resolve({
            ok: false,
            error: '结果不是合法 JSON',
            stdout: (stdout || '').slice(-4000),
            stderr: (stderr || '').slice(-2000),
            elapsedMs,
          })
        }
      },
    )
  }).finally(() => {
    inFlight = null
  })
  return inFlight
}

function sendJson(res, code, body) {
  const text = JSON.stringify(body)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'netops-api' })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/health-check') {
    console.log('[api] 收到体检请求')
    const result = await runHealthCheck()
    console.log(`[api] 体检结束 ok=${result.ok} 用时 ${result.elapsedMs}ms`)
    sendJson(res, result.ok ? 200 : 500, result)
    return
  }

  sendJson(res, 404, { ok: false, error: `没有这个接口：${req.method} ${url.pathname}` })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] 监听 http://127.0.0.1:${PORT}`)
  console.log(`[api] 体检通过 docker exec ${CONTAINER} ${SCRIPT} 执行`)
})
