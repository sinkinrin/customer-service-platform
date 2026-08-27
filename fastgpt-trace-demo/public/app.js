const $ = (id) => document.getElementById(id)

const ui = {
  endpoint: $('endpoint'), keyStatus: $('keyStatus'), connectionDot: $('connectionDot'),
  prompt: $('prompt'), runButton: $('runButton'), demoButton: $('demoButton'), stopButton: $('stopButton'), runState: $('runState'),
  stateMetric: $('stateMetric'), firstTokenMetric: $('firstTokenMetric'), durationMetric: $('durationMetric'), citationMetric: $('citationMetric'),
  charCount: $('charCount'), answerBody: $('answerBody'), answerEmpty: $('answerEmpty'), answerContent: $('answerContent'), errorBox: $('errorBox'),
  timeline: $('timeline'), rawEmpty: $('rawEmpty'), rawDetail: $('rawDetail'), rawTitle: $('rawTitle'), rawKind: $('rawKind'), rawId: $('rawId'), rawJson: $('rawJson'),
  evidenceCount: $('evidenceCount'), evidenceList: $('evidenceList'),
  processOverview: $('processOverview'), processTableBody: $('processTableBody'),
  searchRunCount: $('searchRunCount'), searchRunList: $('searchRunList'), citationMapCount: $('citationMapCount'), citationMapList: $('citationMapList'), sourceSummary: $('sourceSummary'),
  networkOverview: $('networkOverview'), networkLifecycle: $('networkLifecycle'), sseEventTotal: $('sseEventTotal'), eventDistribution: $('eventDistribution'), networkEnvelope: $('networkEnvelope'),
}

const traceStyles = {
  node: { label: '流程节点', symbol: '●' },
  tool: { label: '工具调用', symbol: '◆' },
  retrieval: { label: '知识检索', symbol: '■' },
  system: { label: '流状态', symbol: '•' },
}

let state = 'idle'
let answer = ''
let trace = []
let citations = []
let selectedId = null
let controller = null
let startedAt = null
let firstTokenAt = null
let completedAt = null
let answerDoneRecorded = false
let eventId = 0
let clockTimer = null
let toolRuns = new Map()
let activeDetailTab = 'process'
let advancedRenderQueued = false
let network = {
  requestStartedAt: null,
  responseHeadersAt: null,
  firstEventAt: null,
  firstTokenAt: null,
  completedAt: null,
  bytesReceived: 0,
  eventCount: 0,
  answerEvents: 0,
  eventCounts: {},
  httpStatus: null,
  responseContentType: '',
  upstreamStatus: '',
  upstreamContentType: '',
  upstreamConnectMs: null,
  promptLength: 0,
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

function normalizeCitationRef(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9一-鿿._-]/g, '').trim()
}

function findCitation(marker) {
  const normalized = normalizeCitationRef(marker)
  if (!normalized) return null
  return citations.find((citation) => {
    const id = normalizeCitationRef(citation.sourceId)
    const source = normalizeCitationRef(citation.sourceName)
    return normalized === id || normalized === source || (source.length > 5 && (normalized.includes(source) || source.includes(normalized)))
  }) || null
}

function renderSimpleMarkdown(text) {
  const citeTokens = []
  const tokenized = text.replace(/\[([^\]]+)\]\(CITE\)/g, (_, marker) => {
    const token = `@@CITE_${citeTokens.length}@@`
    citeTokens.push(marker)
    return token
  })
  let html = escapeHtml(tokenized)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)$/gm, '• $1')
    .replace(/\n/g, '<br>')

  citeTokens.forEach((marker, index) => {
    const citation = findCitation(marker)
    const citationIndex = citation ? citations.findIndex((item) => item.key === citation.key) + 1 : null
    const label = citationIndex ? `[${citationIndex}]` : '[引用]'
    html = html.replace(
      `@@CITE_${index}@@`,
      `<button class="inline-cite" type="button" data-cite="${encodeURIComponent(marker)}" title="${escapeHtml(marker)}">${label}</button>`
    )
  })
  return html
}

function stateText(value) {
  return ({ idle: '等待运行', connecting: '连接 FastGPT', streaming: '回答生成中', settling: '整理流程明细', done: '执行完成', stopped: '已手动停止', error: '执行失败' })[value]
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function safePretty(value, max = 16000) {
  let text
  try { text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) } catch { text = String(value) }
  return text.length <= max ? text : `${text.slice(0, max)}\n… truncated ${text.length - max} characters`
}

function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : null }
function firstString(obj, keys) { for (const key of keys) if (typeof obj?.[key] === 'string' && obj[key]) return obj[key] }
function firstNumber(obj, keys) { for (const key of keys) if (typeof obj?.[key] === 'number' && Number.isFinite(obj[key])) return obj[key] }

function summarize(payload) {
  const obj = record(payload)
  if (!obj) return typeof payload === 'string' ? payload.slice(0, 180) : '已收到事件数据'
  const parts = [firstString(obj, ['moduleType', 'type', 'status']), firstString(obj, ['model'])].filter(Boolean)
  const duration = firstNumber(obj, ['runningTime', 'duration', 'durationMs'])
  const tokens = firstNumber(obj, ['tokens', 'totalTokens'])
  if (duration !== undefined) parts.push(`${Math.round(duration)} ms`)
  if (tokens !== undefined) parts.push(`${tokens} tokens`)
  return parts.join(' · ') || '点击查看原始事件'
}

function setState(next) {
  state = next
  const text = stateText(next)
  ui.stateMetric.textContent = text
  ui.runState.textContent = `● ${text}`
  ui.runState.className = `run-state ${['connecting', 'streaming', 'settling'].includes(next) ? 'running' : next}`
  const running = ['connecting', 'streaming', 'settling'].includes(next)
  ui.runButton.disabled = running
  ui.demoButton.disabled = running
  ui.stopButton.disabled = !running
  ui.prompt.disabled = running
  ui.connectionDot.classList.toggle('live', running)
  ui.answerContent.classList.toggle('streaming', running && Boolean(answer))
  ui.answerEmpty.querySelector('.orb')?.classList.toggle('live', running && !answer)
  if (running && !clockTimer) clockTimer = setInterval(renderMetrics, 200)
  if (!running && clockTimer) { clearInterval(clockTimer); clockTimer = null }
}

function renderMetrics() {
  const end = completedAt || Date.now()
  ui.firstTokenMetric.textContent = firstTokenAt && startedAt ? formatDuration(firstTokenAt - startedAt) : '—'
  ui.durationMetric.textContent = startedAt ? formatDuration(end - startedAt) : '—'
  ui.citationMetric.textContent = `${citations.length} 条`
  ui.charCount.textContent = `${answer.length.toLocaleString()} chars`
}

function pushTrace(kind, label, detail, raw, status = 'completed') {
  const id = ++eventId
  trace.push({ id, kind, label, detail, raw: safePretty(raw), status, at: Date.now() })
  selectedId ??= id
  renderTimeline()
  renderRaw()
  scheduleAdvancedRender()
  return id
}

function updateTrace(id, patch) {
  const item = trace.find((entry) => entry.id === id)
  if (!item) return
  Object.assign(item, patch)
  if ('raw' in patch) item.raw = safePretty(patch.raw)
  renderTimeline()
  renderRaw()
  scheduleAdvancedRender()
}

function renderTimeline() {
  if (!trace.length) {
    ui.timeline.className = 'timeline'
    ui.timeline.innerHTML = '<div class="empty-state">⌁<span>尚未收到流程事件</span></div>'
    return
  }
  ui.timeline.className = 'timeline has-events'
  ui.timeline.innerHTML = trace.map((item, index) => `
    <button class="timeline-event ${item.kind} ${selectedId === item.id ? 'selected' : ''}" data-id="${item.id}" type="button">
      <span class="timeline-dot ${item.kind}">${item.status === 'running' ? '↻' : traceStyles[item.kind].symbol}</span>
      <span class="timeline-copy"><span class="timeline-title"><span class="timeline-index">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(item.label)}</strong></span><p>${escapeHtml(item.detail)}</p></span>
      <span class="timeline-time">+${formatDuration(startedAt ? item.at - startedAt : undefined)}</span>
    </button>`).join('')
  ui.timeline.querySelectorAll('.timeline-event').forEach((button) => button.addEventListener('click', () => { selectedId = Number(button.dataset.id); renderTimeline(); renderRaw() }))
}

function renderRaw() {
  const item = trace.find((entry) => entry.id === selectedId) || trace.at(-1)
  ui.rawEmpty.classList.toggle('hidden', Boolean(item))
  ui.rawDetail.classList.toggle('hidden', !item)
  if (!item) return
  ui.rawTitle.textContent = item.label
  ui.rawKind.textContent = traceStyles[item.kind].label
  ui.rawId.textContent = `#${item.id}`
  ui.rawJson.textContent = item.raw
}

function normalizeScore(value) { return typeof value === 'number' && Number.isFinite(value) ? (value > 1 ? value / 100 : value) : undefined }

function cleanSourceName(values, fallback, sourceId) {
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue
    const compact = value.replace(/\s+/g, ' ').trim()
    const fileMatch = compact.match(/[^|<>:"/\\]{1,120}\.(?:pdf|docx?|xlsx?|csv|md|txt|pptx?)/i)
    if (fileMatch) return fileMatch[0].trim()
    if (compact.length <= 160) return compact
  }
  if (sourceId) return `知识条目 · ${sourceId.slice(-8)}`
  return fallback || '未命名知识条目'
}

function citationFrom(value, fallback) {
  const obj = record(value)
  if (!obj) return null
  const indexText = Array.isArray(obj.indexes) ? obj.indexes.map((item) => firstString(record(item), ['text'])).filter(Boolean).join('\n') : ''
  const sourceId = firstString(obj, ['sourceId', 'source_id', 'id'])
  const sourceName = cleanSourceName(
    [obj.sourceName, obj.fileName, obj.documentName, obj.collectionName, obj.datasetName, obj.name, obj.source],
    fallback,
    sourceId
  )
  const question = firstString(obj, ['q', 'question', 'query'])
  const answerText = firstString(obj, ['a', 'answer'])
  const excerpt = firstString(obj, ['text', 'content', 'chunk']) || indexText || undefined
  const datasetId = firstString(obj, ['datasetId', 'dataset_id'])
  const collectionId = firstString(obj, ['collectionId', 'collection_id'])
  if (!question && !answerText && !excerpt && !datasetId && !collectionId && !sourceId) return null
  return { key: sourceId ? `${sourceId}|${sourceName}` : [datasetId, collectionId, sourceName, question].filter(Boolean).join('|') || safePretty(obj, 240), sourceName, score: normalizeScore(obj.score ?? obj.similarity), question, answer: answerText, excerpt, datasetId, collectionId, sourceId }
}

function extractCitations(node) {
  const result = []
  for (const candidate of [node.quoteList, node.citations, node.references, node.sources]) {
    if (!Array.isArray(candidate)) continue
    for (const value of candidate) { const citation = citationFrom(value, firstString(node, ['moduleName', 'name'])); if (citation) result.push(citation) }
  }
  return result
}

function extractToolResponseCitations(value) {
  const result = []
  const roots = Array.isArray(value) ? value : [value]
  for (const rootValue of roots) {
    const root = record(rootValue)
    const nestedResult = record(root?.result)
    if (!nestedResult) continue
    for (const candidate of [nestedResult.cites, nestedResult.quoteList, nestedResult.citations, nestedResult.sources]) {
      if (!Array.isArray(candidate)) continue
      for (const item of candidate) {
        const citation = citationFrom(item, firstString(nestedResult, ['sourceName', 'name']) || 'DatasetSearch')
        if (citation) result.push(citation)
      }
    }
  }
  return result
}

function decodeJsonFragment(value) {
  try { return JSON.parse(`"${value}"`) } catch {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

function readRawStringField(text, field, start, end) {
  const fieldIndex = text.indexOf(`"${field}"`, start)
  if (fieldIndex === -1 || fieldIndex >= end) return undefined
  const colonIndex = text.indexOf(':', fieldIndex)
  const quoteIndex = text.indexOf('"', colonIndex + 1)
  if (colonIndex === -1 || quoteIndex === -1 || quoteIndex >= end) return undefined

  let raw = ''
  for (let index = quoteIndex + 1; index < Math.min(end, text.length); index += 1) {
    const char = text[index]
    if (char === '\\' && index + 1 < text.length) {
      raw += char + text[index + 1]
      index += 1
      continue
    }
    if (char === '"') return decodeJsonFragment(raw)
    raw += char
    if (raw.length >= 1_200) return decodeJsonFragment(raw)
  }
  return raw ? decodeJsonFragment(raw) : undefined
}

function extractRawToolCitations(text) {
  if (typeof text !== 'string' || !text.includes('"cites"')) return []
  const matches = [...text.matchAll(/"id"\s*:\s*"([^"\\]+)"[\s\S]{0,600}?"sourceName"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
  return matches.map((match, index) => {
    const sourceId = decodeJsonFragment(match[1])
    const sourceName = cleanSourceName([decodeJsonFragment(match[2])], 'DatasetSearch', sourceId)
    const start = match.index || 0
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length
    const excerpt = readRawStringField(text, 'content', start, end)
    return {
      key: `${sourceId}|${sourceName}`,
      sourceName,
      sourceId,
      excerpt,
    }
  })
}

function uniqueCitations(values) {
  return [...new Map(values.map((citation) => [citation.key, citation])).values()]
}

function mergeCitations(incoming) {
  const map = new Map(citations.map((item) => [item.key, item]))
  incoming.forEach((item) => map.set(item.key, item))
  citations = [...map.values()]
  renderEvidence()
  if (answer) ui.answerContent.innerHTML = renderSimpleMarkdown(answer)
  renderMetrics()
  scheduleAdvancedRender()
}

function renderEvidence() {
  ui.evidenceCount.textContent = citations.length
  if (!citations.length) {
    ui.evidenceList.innerHTML = '<div class="evidence-empty"><span>⌕</span><h3>还没有解析到引用资料</h3><p>如果工作流执行了知识库搜索，命中的文档与片段会显示在这里。</p></div>'
    return
  }
  ui.evidenceList.innerHTML = citations.map((item, index) => {
    const score = Number.isFinite(item.score) ? `${Math.round(Math.max(0, Math.min(1, item.score)) * 100)}%` : ''
    const ids = [['dataset', item.datasetId], ['collection', item.collectionId], ['source', item.sourceId]].filter(([, value]) => value).map(([name, value]) => `<div>${name}: ${escapeHtml(value)}</div>`).join('')
    return `<article class="evidence-card" data-key="${encodeURIComponent(item.key)}"><div class="evidence-title"><span class="file-icon">▤</span><div><h3>${escapeHtml(item.sourceName)}</h3><small>EVIDENCE ${String(index + 1).padStart(2, '0')}</small></div>${score ? `<span class="score">${score}</span>` : ''}</div>${item.question ? `<div class="evidence-question"><strong>命中问题：</strong>${escapeHtml(item.question)}</div>` : ''}${item.answer || item.excerpt ? `<blockquote class="evidence-quote">${escapeHtml((item.answer || item.excerpt).slice(0, 600))}</blockquote>` : ''}${ids ? `<div class="evidence-ids">${ids}</div>` : ''}</article>`
  }).join('')
}

function scheduleAdvancedRender() {
  if (advancedRenderQueued) return
  advancedRenderQueued = true
  requestAnimationFrame(() => {
    advancedRenderQueued = false
    renderAdvanced()
  })
}

function renderKpis(container, items) {
  container.innerHTML = items.map((item) => `
    <div class="detail-kpi">
      <span>${escapeHtml(item.label)}</span>
      <strong title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.note || '')}</small>
    </div>`).join('')
}

function collectModelsAndTokens() {
  const models = new Set()
  let tokens = 0
  for (const item of trace) {
    const payload = parseLooseJson(item.raw)
    const obj = record(payload)
    const model = firstString(obj, ['model'])
    if (model) models.add(model)
    for (const key of ['tokens', 'totalTokens', 'toolCallInputTokens', 'toolCallOutputTokens']) {
      if (typeof obj?.[key] === 'number') tokens += obj[key]
    }
  }
  return { models: [...models], tokens }
}

function renderProcessDetail() {
  const { models, tokens } = collectModelsAndTokens()
  renderKpis(ui.processOverview, [
    { label: '执行事件', value: String(trace.length), note: 'Demo 归一化后的事件' },
    { label: '工具调用', value: String(toolRuns.size), note: [...toolRuns.values()].map((run) => run.toolName).join(', ') || '未调用工具' },
    { label: '流程节点', value: String(trace.filter((item) => item.kind === 'node').length), note: 'flowNodeStatus / flowResponses' },
    { label: '模型', value: models.length ? String(models.length) : '—', note: models.join(', ') || '上游未返回模型名' },
    { label: 'Token 字段合计', value: tokens ? tokens.toLocaleString() : '—', note: '仅统计 API 明确返回的字段' },
  ])

  if (!trace.length) {
    ui.processTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">运行后显示节点、工具和状态明细</td></tr>'
    return
  }

  ui.processTableBody.innerHTML = trace.map((item, index) => `
    <tr>
      <td>${String(index + 1).padStart(2, '0')}</td>
      <td><span class="table-kind"><i class="${item.kind}"></i>${traceStyles[item.kind].label}</span></td>
      <td>${escapeHtml(item.label)}</td>
      <td><span class="table-status ${item.status}">${escapeHtml(item.status)}</span></td>
      <td>+${formatDuration(startedAt ? item.at - startedAt : undefined)}</td>
      <td>${escapeHtml(item.detail)}</td>
    </tr>`).join('')
}

function collectQueryValues(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectQueryValues(item, result))
    return result
  }
  const obj = record(value)
  if (!obj) {
    if (typeof value === 'string' && value.trim() && value.length < 240) result.push(value.trim())
    return result
  }
  for (const [key, nested] of Object.entries(obj)) {
    if (/query|keyword|question|search/i.test(key)) collectQueryValues(nested, result)
  }
  return result
}

function answerCitationMarkers() {
  return [...answer.matchAll(/\[([^\]]+)\]\(CITE\)/g)].map((match) => match[1])
}

function renderKnowledgeDetail() {
  const runs = [...toolRuns.values()].filter((run) => /search|dataset|knowledge|retriev/i.test(run.toolName) || run.citationCount > 0)
  ui.searchRunCount.textContent = String(runs.length)
  ui.searchRunList.innerHTML = runs.length ? runs.map((run) => {
    const params = parseLooseJson(run.params || '')
    const queries = [...new Set(collectQueryValues(params))]
    return `<article class="search-run">
      <div class="search-run-head"><strong>${escapeHtml(run.toolName)}</strong><code>${escapeHtml(run.callId)}</code></div>
      <div class="query-tags">${queries.length ? queries.map((query) => `<span class="query-tag">${escapeHtml(query)}</span>`).join('') : '<span class="query-tag">参数中未发现 query 字段</span>'}</div>
      <div class="search-run-meta"><span>${run.paramLength || 0} 参数字符</span><span>${run.responseBytes ? formatBytes(run.responseBytes) : '等待结果'}</span><span>${run.citationCount || 0} 条引用</span></div>
    </article>`
  }).join('') : '<div class="detail-empty">当前回答没有调用知识库搜索工具</div>'

  const markers = answerCitationMarkers()
  ui.citationMapCount.textContent = String(markers.length)
  ui.citationMapList.innerHTML = markers.length ? markers.map((marker, index) => {
    const matched = findCitation(marker)
    return `<article class="citation-map-item">
      <div class="citation-map-head"><strong>${escapeHtml(marker)}</strong><code>CITE ${String(index + 1).padStart(2, '0')}</code></div>
      <div class="citation-arrow">↓</div>
      <div class="citation-target ${matched ? 'matched' : ''}">${matched ? `✓ ${escapeHtml(matched.sourceName)}${matched.sourceId ? ` · ${escapeHtml(matched.sourceId)}` : ''}` : '未能与返回的 cites 条目匹配'}</div>
    </article>`
  }).join('') : '<div class="detail-empty">回答正文没有返回 (CITE) 标记</div>'

  const sources = new Map()
  citations.forEach((citation) => sources.set(citation.sourceName, (sources.get(citation.sourceName) || 0) + 1))
  ui.sourceSummary.innerHTML = sources.size ? [...sources.entries()].map(([name, count]) => `
    <div class="source-chip"><strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong><span>${count} chunks</span></div>`).join('') : ''
}

function renderNetworkDetail() {
  const totalDuration = network.requestStartedAt ? (network.completedAt || Date.now()) - network.requestStartedAt : undefined
  const firstEvent = network.requestStartedAt && network.firstEventAt ? network.firstEventAt - network.requestStartedAt : undefined
  const firstToken = network.requestStartedAt && network.firstTokenAt ? network.firstTokenAt - network.requestStartedAt : undefined
  renderKpis(ui.networkOverview, [
    { label: 'HTTP 状态', value: network.httpStatus ? String(network.httpStatus) : '—', note: network.responseContentType || '等待响应头' },
    { label: '上游连接', value: network.upstreamConnectMs !== null ? formatDuration(network.upstreamConnectMs) : '—', note: network.upstreamStatus ? `FastGPT HTTP ${network.upstreamStatus}` : '由代理响应头返回' },
    { label: '接收数据', value: formatBytes(network.bytesReceived), note: `${network.eventCount.toLocaleString()} SSE events` },
    { label: '首事件 / 首 Token', value: `${formatDuration(firstEvent)} / ${formatDuration(firstToken)}`, note: '从浏览器发起请求开始' },
    { label: '总耗时', value: formatDuration(totalDuration), note: `${network.answerEvents.toLocaleString()} answer frames` },
  ])

  const lifecycle = [
    ['浏览器发起请求', network.requestStartedAt, 0],
    ['收到代理响应头', network.responseHeadersAt, network.requestStartedAt ? network.responseHeadersAt - network.requestStartedAt : undefined],
    ['收到第一个 SSE 事件', network.firstEventAt, network.requestStartedAt ? network.firstEventAt - network.requestStartedAt : undefined],
    ['收到第一个回答 Token', network.firstTokenAt, network.requestStartedAt ? network.firstTokenAt - network.requestStartedAt : undefined],
    ['响应流关闭', network.completedAt, network.requestStartedAt ? network.completedAt - network.requestStartedAt : undefined],
  ].filter(([, timestamp]) => timestamp)
  ui.networkLifecycle.innerHTML = lifecycle.length ? lifecycle.map(([label, , offset]) => `
    <li><span></span><strong>${escapeHtml(label)}</strong><code>+${formatDuration(offset)}</code></li>`).join('') : '<li><span></span><strong>等待请求</strong><code>—</code></li>'

  const counts = Object.entries(network.eventCounts).sort((a, b) => b[1] - a[1])
  const maxCount = Math.max(1, ...counts.map(([, count]) => count))
  ui.sseEventTotal.textContent = `${network.eventCount.toLocaleString()} events`
  ui.eventDistribution.innerHTML = counts.length ? counts.map(([name, count]) => `
    <div class="event-row"><label title="${escapeHtml(name)}">${escapeHtml(name)}</label><div class="event-track"><div class="event-bar" style="width:${Math.max(1.5, count / maxCount * 100)}%"></div></div><code>${count.toLocaleString()}</code></div>`).join('') : '<div class="detail-empty">尚未收到 SSE 事件</div>'

  ui.networkEnvelope.textContent = JSON.stringify({
    request: {
      endpoint: ui.endpoint.textContent,
      method: 'POST',
      body: { chatId: 'generated server-side', stream: true, detail: true, messageLength: network.promptLength },
    },
    response: {
      browserStatus: network.httpStatus,
      browserContentType: network.responseContentType || null,
      upstreamStatus: network.upstreamStatus || null,
      upstreamContentType: network.upstreamContentType || null,
      bytesReceived: network.bytesReceived,
      streamClosed: Boolean(network.completedAt),
    },
  }, null, 2)
}

function renderAdvanced() {
  renderProcessDetail()
  renderKnowledgeDetail()
  renderNetworkDetail()
}

function setDetailTab(tab) {
  activeDetailTab = tab
  document.querySelectorAll('.detail-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab))
  document.querySelectorAll('.detail-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tab))
  scheduleAdvancedRender()
}

function parseSSEBlock(block) {
  let event = 'message'; const data = []
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) event = line.slice(6).trim() || 'message'
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  return data.length ? { event, data: data.join('\n') } : null
}

function takeBlock(buffer) {
  const unix = buffer.indexOf('\n\n'); const windows = buffer.indexOf('\r\n\r\n')
  if (unix === -1 && windows === -1) return null
  const useWindows = windows !== -1 && (unix === -1 || windows < unix)
  const index = useWindows ? windows : unix
  return { block: buffer.slice(0, index), rest: buffer.slice(index + (useWindows ? 4 : 2)) }
}

function parsePayload(data) { if (data === '[DONE]') return data; try { return JSON.parse(data) } catch { return data } }

function parseLooseJson(value) {
  if (typeof value !== 'string' || !value.trim()) return value
  try { return JSON.parse(value) } catch {}

  let inString = false
  let escaped = false
  let repaired = ''
  for (const char of value) {
    if (escaped) { repaired += char; escaped = false; continue }
    if (char === '\\' && inString) { repaired += char; escaped = true; continue }
    if (char === '"') { repaired += char; inString = !inString; continue }
    if (inString && char.charCodeAt(0) < 32) {
      repaired += char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
      continue
    }
    repaired += char
  }

  try { return JSON.parse(repaired) } catch { return value }
}

function answerDelta(payload) {
  const obj = record(payload); const choice = Array.isArray(obj?.choices) ? record(obj.choices[0]) : null
  const content = record(choice?.delta)?.content ?? record(choice?.message)?.content
  if (typeof content === 'string') return content
  if (typeof obj?.response === 'string') return obj.response
  if (typeof obj?.answer === 'string') return obj.answer
  if (typeof payload === 'string' && payload !== '[DONE]') return payload
  return ''
}

function handleFlowResponses(payload) {
  const obj = record(payload)
  const responses = Array.isArray(payload) ? payload : Array.isArray(obj?.responseData) ? obj.responseData : Array.isArray(obj?.flowResponses) ? obj.flowResponses : []
  if (!responses.length) { pushTrace('system', '收到完整流程响应', '结构与当前解析器预期不同，可查看原始事件。', payload); return }
  for (const value of responses) {
    const node = record(value); if (!node) continue
    const type = (firstString(node, ['moduleType', 'type']) || 'workflowNode').toLowerCase()
    const kind = type.includes('dataset') || type.includes('knowledge') || type.includes('search') ? 'retrieval' : type.includes('tool') || type.includes('plugin') ? 'tool' : 'node'
    pushTrace(kind, firstString(node, ['moduleName', 'name']) || type, summarize(node), node)
    mergeCitations(extractCitations(node))
  }
}

function handleEvent(sse) {
  const payload = parsePayload(sse.data); const obj = record(payload); const name = sse.event || 'message'
  const now = Date.now()
  network.firstEventAt ||= now
  network.eventCount += 1
  network.eventCounts[name] = (network.eventCounts[name] || 0) + 1
  if (['answer', 'fastAnswer', 'message'].includes(name)) network.answerEvents += 1
  scheduleAdvancedRender()
  if (['answer', 'fastAnswer', 'message'].includes(name)) {
    if (payload === '[DONE]') { if (!answerDoneRecorded) { answerDoneRecorded = true; pushTrace('system', '回答文本已结束', '连接保持打开，继续等待 flowResponses。', payload, 'info') }; setState('settling'); return }
    const delta = answerDelta(payload)
    if (delta) { if (!firstTokenAt) { firstTokenAt = Date.now(); network.firstTokenAt = firstTokenAt; } answer += delta; ui.answerEmpty.classList.add('hidden'); ui.answerContent.classList.remove('hidden'); ui.answerContent.innerHTML = renderSimpleMarkdown(answer); setState('streaming'); renderMetrics() }
    return
  }
  if (name === 'flowNodeStatus') { const status = firstString(obj, ['status']); pushTrace('node', firstString(obj, ['name', 'moduleName']) || '工作流节点', summarize(payload), payload, status === 'running' ? 'running' : status === 'error' ? 'failed' : 'completed'); return }
  if (name === 'toolCall') {
    const tool = record(obj?.tool)
    const callId = firstString(obj, ['responseValueId', 'callId', 'id']) || firstString(tool, ['id']) || `tool-${eventId + 1}`
    const toolName = firstString(tool, ['toolName', 'functionName', 'name']) || firstString(obj, ['toolName', 'name', 'moduleName']) || '调用工具'
    const traceId = pushTrace('tool', toolName, 'FastGPT 已发起工具调用，正在接收参数。', payload, 'running')
    toolRuns.set(callId, { callId, toolName, params: '', paramLength: 0, traceId, startedAt: Date.now(), citationCount: 0, responseBytes: 0 })
    return
  }
  if (name === 'toolParams') {
    const tool = record(obj?.tool)
    const callId = firstString(obj, ['responseValueId', 'callId', 'id']) || firstString(tool, ['id']) || `tool-${eventId + 1}`
    const current = toolRuns.get(callId) || {
      callId,
      toolName: firstString(tool, ['toolName', 'functionName', 'name']) || '工具调用',
      params: '',
      paramLength: 0,
      startedAt: Date.now(),
      citationCount: 0,
      responseBytes: 0,
      traceId: pushTrace('tool', '工具调用', '正在接收工具参数。', payload, 'running'),
    }
    const paramsFragment = firstString(tool, ['params']) || (obj?.arguments !== undefined ? JSON.stringify(obj.arguments) : '')
    current.params += paramsFragment
    current.paramLength = current.params.length
    toolRuns.set(callId, current)
    updateTrace(current.traceId, {
      label: current.toolName,
      detail: `正在接收工具参数 · ${current.params.length} chars`,
      raw: { callId, toolName: current.toolName, params: parseLooseJson(current.params) },
      status: 'running',
    })
    return
  }
  if (name === 'toolResponse') {
    const tool = record(obj?.tool)
    const callId = firstString(obj, ['responseValueId', 'callId', 'id']) || firstString(tool, ['id']) || `tool-${eventId + 1}`
    const current = toolRuns.get(callId)
    const toolName = current?.toolName || firstString(tool, ['toolName', 'functionName', 'name']) || '工具返回结果'
    const responseText = firstString(tool, ['response']) || (obj?.result !== undefined ? JSON.stringify(obj.result) : '')
    const responseValue = parseLooseJson(responseText)
    const foundCitations = uniqueCitations([
      ...extractToolResponseCitations(responseValue),
      ...extractRawToolCitations(responseText),
    ])
    mergeCitations(foundCitations)
    const raw = {
      callId,
      toolName,
      params: parseLooseJson(current?.params || firstString(tool, ['params']) || ''),
      response: responseValue,
    }
    if (current) {
      current.responseBytes = new TextEncoder().encode(responseText).length
      current.citationCount = foundCitations.length
      current.completedAt = Date.now()
      current.response = responseValue
      toolRuns.set(callId, current)
      updateTrace(current.traceId, {
        label: toolName,
        detail: `工具执行完成${foundCitations.length ? ` · 提取 ${foundCitations.length} 条知识引用` : ''}`,
        raw,
        status: 'completed',
      })
    } else {
      const traceId = pushTrace('tool', toolName, `工具执行完成${foundCitations.length ? ` · 提取 ${foundCitations.length} 条知识引用` : ''}`, raw)
      toolRuns.set(callId, {
        callId,
        toolName,
        params: firstString(tool, ['params']) || '',
        paramLength: (firstString(tool, ['params']) || '').length,
        response: responseValue,
        responseBytes: new TextEncoder().encode(responseText).length,
        citationCount: foundCitations.length,
        completedAt: Date.now(),
        traceId,
      })
    }
    scheduleAdvancedRender()
    return
  }
  if (name === 'flowResponses') { handleFlowResponses(payload); return }
  if (name === 'error') {
    const message = obj?.code === 514 || obj?.statusText === 'unAuthApiKey'
      ? 'FastGPT 拒绝了当前 API Key（514 unAuthApiKey）。请在新 FastGPT 实例的目标应用中重新创建“应用 API Key”，不要使用 App ID、登录 Token 或旧实例的 Key。'
      : firstString(obj, ['message', 'error']) || safePretty(payload, 500)
    fail(message, payload)
    return
  }
  pushTrace('system', name, summarize(payload), payload, 'info')
}

function fail(message, raw = message) {
  ui.errorBox.textContent = message; ui.errorBox.classList.remove('hidden'); pushTrace('system', '请求失败', message, raw, 'failed'); completedAt = Date.now(); network.completedAt = completedAt; setState('error'); renderMetrics(); renderAdvanced()
}

function resetRun() {
  answer = ''; trace = []; citations = []; selectedId = null; eventId = 0; answerDoneRecorded = false; toolRuns = new Map()
  startedAt = Date.now(); firstTokenAt = null; completedAt = null
  network = {
    requestStartedAt: startedAt,
    responseHeadersAt: null,
    firstEventAt: null,
    firstTokenAt: null,
    completedAt: null,
    bytesReceived: 0,
    eventCount: 0,
    answerEvents: 0,
    eventCounts: {},
    httpStatus: null,
    responseContentType: '',
    upstreamStatus: '',
    upstreamContentType: '',
    upstreamConnectMs: null,
    promptLength: ui.prompt.value.trim().length,
  }
  ui.answerContent.innerHTML = ''; ui.answerContent.classList.add('hidden')
  ui.answerEmpty.classList.remove('hidden'); ui.errorBox.classList.add('hidden')
  renderTimeline(); renderRaw(); renderEvidence(); renderMetrics(); renderAdvanced()
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

async function playSample() {
  if (['connecting', 'streaming', 'settling'].includes(state)) return
  controller?.abort(); controller = new AbortController(); resetRun(); setState('connecting')

  try {
    await pause(350, controller.signal)
    network.responseHeadersAt = Date.now()
    network.httpStatus = 200
    network.responseContentType = 'text/event-stream; charset=utf-8'
    network.upstreamStatus = '200'
    network.upstreamContentType = 'text/event-stream'
    network.upstreamConnectMs = network.responseHeadersAt - network.requestStartedAt
    pushTrace('system', '已连接示例事件流', '本地回放：结构与真实 FastGPT detail=true SSE 相同。', { mode: 'sample-replay', detail: true })
    handleEvent({ event: 'flowNodeStatus', data: JSON.stringify({ nodeId: 'dataset-search', name: '搜索客服知识库', moduleType: 'datasetSearchNode', status: 'running' }) })
    await pause(500, controller.signal)
    handleEvent({ event: 'flowNodeStatus', data: JSON.stringify({ nodeId: 'intent', name: '识别问题与排查意图', moduleType: 'classifyQuestion', status: 'running' }) })
    await pause(420, controller.signal)
    handleEvent({ event: 'toolCall', data: JSON.stringify({ toolName: 'DatasetSearch', callId: 'tool-call-01' }) })
    await pause(300, controller.signal)
    handleEvent({ event: 'toolParams', data: JSON.stringify({ toolName: 'DatasetSearch', callId: 'tool-call-01', arguments: { query: ['登录循环', 'SSO callback', 'session cookie'] } }) })
    await pause(520, controller.signal)
    handleEvent({ event: 'toolResponse', data: JSON.stringify({ toolName: 'DatasetSearch', callId: 'tool-call-01', status: 'success', durationMs: 486, result: { matchedDocuments: 2, dominantCause: 'expired session cookie after SSO callback' } }) })
    await pause(350, controller.signal)

    const chunks = [
      '根据知识库与近期故障记录，这类“登录后反复跳回登录页”通常与浏览器 Cookie、SSO 回调地址或账号状态有关。\n\n',
      '### 建议排查顺序\n\n1. 请客户使用无痕窗口重新登录，确认是否为旧 Cookie 导致。[登录循环排查手册.md](CITE)\n',
      '2. 核对访问域名是否与工单中记录的正式入口一致，避免从旧书签进入。\n',
      '3. 如果仍然复现，记录发生时间、账号邮箱和浏览器版本，交由技术支持核对 SSO 回调日志。[SSO 回调异常处理指南.pdf](CITE)\n\n',
      '**建议回复：** 已为您整理快速排查步骤。请先清除该站点 Cookie 或使用无痕窗口重试；如果问题持续，请回复发生时间与浏览器版本，我们会继续核对登录日志。'
    ]
    for (const content of chunks) {
      handleEvent({ event: 'answer', data: JSON.stringify({ choices: [{ delta: { content }, index: 0, finish_reason: null }] }) })
      await pause(260, controller.signal)
    }

    handleEvent({ event: 'answer', data: '[DONE]' })
    await pause(650, controller.signal)
    handleEvent({
      event: 'flowResponses',
      data: JSON.stringify([
        {
          nodeId: 'dataset-search', moduleName: '搜索客服知识库', moduleType: 'datasetSearchNode', runningTime: 612, model: 'Embedding-2', tokens: 38,
          quoteList: [
            { id: 'quote-01', datasetId: 'kb-support', collectionId: 'auth-troubleshooting', sourceName: '登录循环排查手册.md', sourceId: 'doc-login-loop', score: 0.93, q: '登录后跳回登录页如何处理？', a: '先排除旧 Cookie 与错误入口，再收集时间、账号和浏览器信息核对 SSO 回调日志。' },
            { id: 'quote-02', datasetId: 'kb-support', collectionId: 'sso-operations', sourceName: 'SSO 回调异常处理指南.pdf', sourceId: 'doc-sso-callback', score: 0.86, q: '需要收集哪些诊断信息？', a: '记录账号、发生时间、浏览器版本、访问域名和 request id，避免要求客户提供密码。' }
          ]
        },
        { nodeId: 'tool-node', moduleName: '查询近期登录故障', moduleType: 'pluginOutput', runningTime: 486, pluginOutput: { matchedIncidents: 3, dominantCause: 'expired session cookie after SSO callback' } },
        { nodeId: 'chat-node', moduleName: '生成客服回复', moduleType: 'chatNode', runningTime: 1328, model: 'FastGPT configured model', tokens: 426 }
      ])
    })
    completedAt = Date.now(); network.completedAt = completedAt; setState('done'); renderMetrics(); renderAdvanced()
  } catch (error) {
    if (error?.name === 'AbortError') {
      completedAt = Date.now(); network.completedAt = completedAt; pushTrace('system', '已停止示例回放', '由当前用户手动停止。', 'aborted', 'info'); setState('stopped'); renderMetrics(); renderAdvanced(); return
    }
    fail(error instanceof Error ? error.message : 'Sample replay failed')
  }
}

async function run() {
  const message = ui.prompt.value.trim(); if (!message || ['connecting', 'streaming', 'settling'].includes(state)) return
  controller?.abort(); controller = new AbortController(); resetRun(); setState('connecting')
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal: controller.signal })
    network.responseHeadersAt = Date.now()
    network.httpStatus = response.status
    network.responseContentType = response.headers.get('content-type') || ''
    network.upstreamStatus = response.headers.get('x-upstream-status') || ''
    network.upstreamContentType = response.headers.get('x-upstream-content-type') || ''
    const upstreamConnect = Number(response.headers.get('x-upstream-connect-ms'))
    network.upstreamConnectMs = Number.isFinite(upstreamConnect) ? upstreamConnect : null
    scheduleAdvancedRender()
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || `Request failed (HTTP ${response.status})`) }
    if (!response.body) throw new Error('The demo server returned no readable stream.')
    pushTrace('system', '已连接 FastGPT', ui.endpoint.textContent, { endpoint: ui.endpoint.textContent }); setState('streaming')
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      network.bytesReceived += value.byteLength
      buffer += decoder.decode(value, { stream: true })
      while (true) { const next = takeBlock(buffer); if (!next) break; buffer = next.rest; const parsed = parseSSEBlock(next.block); if (parsed) handleEvent(parsed) }
    }
    buffer += decoder.decode(); if (buffer.trim()) { const parsed = parseSSEBlock(buffer.trim()); if (parsed) handleEvent(parsed) }
    completedAt = Date.now(); network.completedAt = completedAt; if (state !== 'error') setState('done'); renderMetrics(); renderAdvanced()
  } catch (error) {
    if (error?.name === 'AbortError') { completedAt = Date.now(); network.completedAt = completedAt; pushTrace('system', '已停止读取响应流', '由当前用户手动停止。', 'aborted', 'info'); setState('stopped'); renderMetrics(); renderAdvanced(); return }
    fail(error instanceof Error ? error.message : 'Run failed')
  }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config'); const config = await response.json()
    ui.endpoint.textContent = config.endpoint || 'Unknown endpoint'
    ui.keyStatus.textContent = config.configured ? 'API Key 已读取，调用时验证' : '缺少 FASTGPT_API_KEY'
    ui.keyStatus.className = `key-status ${config.configured ? 'ready' : 'missing'}`
  } catch { ui.endpoint.textContent = 'Demo server unavailable'; ui.keyStatus.textContent = '无法读取配置'; ui.keyStatus.className = 'key-status missing' }
}

ui.runButton.addEventListener('click', run)
ui.demoButton.addEventListener('click', playSample)
ui.stopButton.addEventListener('click', () => controller?.abort())
ui.prompt.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') run() })
document.querySelectorAll('.detail-tab').forEach((button) => button.addEventListener('click', () => setDetailTab(button.dataset.tab)))
ui.answerContent.addEventListener('click', (event) => {
  const button = event.target.closest?.('.inline-cite')
  if (!button) return
  const marker = decodeURIComponent(button.dataset.cite || '')
  const citation = findCitation(marker)
  setDetailTab('knowledge')
  if (!citation) return
  const card = ui.evidenceList.querySelector(`[data-key="${CSS.escape(encodeURIComponent(citation.key))}"]`)
  if (card) {
    card.classList.remove('flash')
    requestAnimationFrame(() => {
      card.classList.add('flash')
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})
loadConfig(); renderTimeline(); renderEvidence(); renderMetrics(); renderAdvanced(); setDetailTab(activeDetailTab); setState('idle')
