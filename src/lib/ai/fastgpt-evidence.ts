export interface AiCitationEvidence {
  id: string
  sourceName: string
  content: string
  updateTime?: string
  score?: number
  datasetId?: string
  collectionId?: string
}

export interface AiKnowledgeSearchEvidence {
  callId: string
  toolName: string
  queries: string[]
  citationCount: number
}

export interface AiAnswerEvidence {
  version: 1
  provider: 'fastgpt'
  searches: AiKnowledgeSearchEvidence[]
  citations: AiCitationEvidence[]
}

type UnknownRecord = Record<string, unknown>

type ToolRun = {
  callId: string
  toolName: string
  params: string
}

const MAX_SEARCHES = 8
const MAX_QUERIES_PER_SEARCH = 8
const MAX_CITATIONS = 20
const MAX_QUERY_LENGTH = 240
const MAX_SOURCE_NAME_LENGTH = 180
const MAX_CONTENT_LENGTH = 2_000
const MAX_TOOL_PARAMS_LENGTH = 20_000
const MAX_TOOL_RESPONSE_LENGTH = 256_000
const MAX_EVIDENCE_EVENT_LENGTH = 512_000

const EVIDENCE_EVENTS = new Set([
  'toolCall',
  'toolParams',
  'toolResponse',
  'flowResponses',
])

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function firstString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength)}…`
}

function parseLooseJson(value: string): unknown {
  if (!value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    // FastGPT tool responses can contain literal control characters inside JSON
    // string values. Repair only those characters, leaving structure unchanged.
  }

  let inString = false
  let escaped = false
  let repaired = ''

  for (const char of value) {
    if (escaped) {
      repaired += char
      escaped = false
      continue
    }
    if (char === '\\' && inString) {
      repaired += char
      escaped = true
      continue
    }
    if (char === '"') {
      repaired += char
      inString = !inString
      continue
    }
    if (inString && char.charCodeAt(0) < 32) {
      repaired += char === '\n'
        ? '\\n'
        : char === '\r'
          ? '\\r'
          : char === '\t'
            ? '\\t'
            : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
      continue
    }
    repaired += char
  }

  try {
    return JSON.parse(repaired)
  } catch {
    return null
  }
}

function decodeJsonFragment(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

function readRawStringField(text: string, field: string, start: number, end: number): string | undefined {
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
    if (raw.length >= MAX_CONTENT_LENGTH * 2) return decodeJsonFragment(raw)
  }
  return raw ? decodeJsonFragment(raw) : undefined
}

function cleanSourceName(values: unknown[], fallback: string, id: string): string {
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue
    const compact = value.replace(/\s+/g, ' ').trim()
    const fileMatch = compact.match(/[^|<>:"/\\]{1,140}\.(?:pdf|docx?|xlsx?|csv|md|txt|pptx?)/i)
    if (fileMatch) return truncate(fileMatch[0], MAX_SOURCE_NAME_LENGTH)
    if (compact.length <= MAX_SOURCE_NAME_LENGTH) return compact
  }
  return id ? `Knowledge item · ${id.slice(-8)}` : fallback
}

function normalizeScore(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value))
}

function citationFromUnknown(value: unknown, fallbackSource = 'FastGPT knowledge base'): AiCitationEvidence | null {
  const record = asRecord(value)
  if (!record) return null

  const id = firstString(record, ['sourceId', 'source_id', 'id']) || ''
  const sourceName = cleanSourceName(
    [
      record.sourceName,
      record.fileName,
      record.documentName,
      record.collectionName,
      record.datasetName,
      record.name,
      record.source,
    ],
    fallbackSource,
    id
  )
  const indexes = Array.isArray(record.indexes) ? record.indexes : []
  const indexText = indexes
    .map(item => firstString(asRecord(item), ['text']))
    .filter((item): item is string => Boolean(item))
    .join('\n')
  const content = firstString(record, ['content', 'text', 'chunk', 'a', 'answer']) || indexText

  if (!id && !content) return null

  return {
    id: id || `${sourceName}:${content?.slice(0, 80) || ''}`,
    sourceName,
    content: truncate(content || '', MAX_CONTENT_LENGTH),
    ...(firstString(record, ['updateTime', 'updatedAt', 'updated_at'])
      ? { updateTime: firstString(record, ['updateTime', 'updatedAt', 'updated_at']) }
      : {}),
    ...(normalizeScore(record.score ?? record.similarity) !== undefined
      ? { score: normalizeScore(record.score ?? record.similarity) }
      : {}),
    ...(firstString(record, ['datasetId', 'dataset_id'])
      ? { datasetId: firstString(record, ['datasetId', 'dataset_id']) }
      : {}),
    ...(firstString(record, ['collectionId', 'collection_id'])
      ? { collectionId: firstString(record, ['collectionId', 'collection_id']) }
      : {}),
  }
}

function extractStructuredCitations(value: unknown): AiCitationEvidence[] {
  const citations: AiCitationEvidence[] = []
  const roots = Array.isArray(value) ? value : [value]

  for (const rootValue of roots) {
    const root = asRecord(rootValue)
    if (!root) continue
    const result = asRecord(root.result) || root
    const fallback = firstString(result, ['moduleName', 'name']) || 'FastGPT knowledge base'
    for (const candidate of [result.cites, result.quoteList, result.citations, result.sources]) {
      if (!Array.isArray(candidate)) continue
      for (const item of candidate) {
        const citation = citationFromUnknown(item, fallback)
        if (citation) citations.push(citation)
      }
    }
  }

  return citations
}

function extractRawCitations(text: string): AiCitationEvidence[] {
  if (!text.includes('"cites"')) return []
  const matches = [...text.matchAll(/"id"\s*:\s*"([^"\\]+)"[\s\S]{0,600}?"sourceName"\s*:\s*"((?:\\.|[^"\\])*)"/g)]

  return matches.map((match, index) => {
    const id = decodeJsonFragment(match[1])
    const sourceName = cleanSourceName([decodeJsonFragment(match[2])], 'FastGPT knowledge base', id)
    const start = match.index || 0
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length
    const content = readRawStringField(text, 'content', start, end) || ''
    return {
      id,
      sourceName,
      content: truncate(content, MAX_CONTENT_LENGTH),
    }
  })
}

function collectQueryValues(value: unknown, result: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectQueryValues(item, result)
    return result
  }
  const record = asRecord(value)
  if (!record) {
    if (typeof value === 'string' && value.trim()) {
      result.push(truncate(value, MAX_QUERY_LENGTH))
    }
    return result
  }
  for (const [key, nested] of Object.entries(record)) {
    if (/query|keyword|question|search/i.test(key)) collectQueryValues(nested, result)
  }
  return result
}

function parseEventPayload(data: string): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

function normalizeEvidence(value: unknown): AiAnswerEvidence | null {
  const record = asRecord(value)
  if (record?.version !== 1 || record.provider !== 'fastgpt') return null

  const searches = Array.isArray(record.searches)
    ? record.searches.slice(0, MAX_SEARCHES).flatMap((item) => {
        const search = asRecord(item)
        if (!search) return []
        const callId = firstString(search, ['callId'])
        const toolName = firstString(search, ['toolName'])
        if (!callId || !toolName) return []
        return [{
          callId,
          toolName,
          queries: Array.isArray(search.queries)
            ? search.queries.filter((query): query is string => typeof query === 'string').slice(0, MAX_QUERIES_PER_SEARCH)
            : [],
          citationCount: typeof search.citationCount === 'number' ? search.citationCount : 0,
        }]
      })
    : []

  const citations = Array.isArray(record.citations)
    ? record.citations.slice(0, MAX_CITATIONS).flatMap(item => {
        const citation = citationFromUnknown(item)
        return citation ? [citation] : []
      })
    : []

  return { version: 1, provider: 'fastgpt', searches, citations }
}

export function parseAiAnswerEvidence(value: unknown): AiAnswerEvidence | null {
  return normalizeEvidence(value)
}

export function createFastGPTEvidenceAccumulator() {
  const tools = new Map<string, ToolRun>()
  const searches = new Map<string, AiKnowledgeSearchEvidence>()
  const citations = new Map<string, AiCitationEvidence>()

  const addCitations = (values: AiCitationEvidence[]) => {
    for (const citation of values) {
      const key = `${citation.id}|${citation.sourceName}`
      if (!citations.has(key) && citations.size < MAX_CITATIONS) citations.set(key, citation)
    }
  }

  const addSearch = (callId: string, toolName: string, queries: string[], citationCount: number) => {
    if (searches.size >= MAX_SEARCHES && !searches.has(callId)) return
    searches.set(callId, {
      callId,
      toolName,
      queries: [...new Set(queries)].slice(0, MAX_QUERIES_PER_SEARCH),
      citationCount,
    })
  }

  return {
    consume(event: string, data: string) {
      if (!EVIDENCE_EVENTS.has(event) || data.length > MAX_EVIDENCE_EVENT_LENGTH) return
      const payload = parseEventPayload(data)
      const record = asRecord(payload)

      if (event === 'toolCall') {
        const tool = asRecord(record?.tool)
        const callId = firstString(record, ['responseValueId', 'callId', 'id']) || firstString(tool, ['id'])
        if (!callId) return
        tools.set(callId, {
          callId,
          toolName: firstString(tool, ['toolName', 'functionName', 'name']) || firstString(record, ['toolName', 'name']) || 'FastGPT tool',
          params: '',
        })
        return
      }

      if (event === 'toolParams') {
        const tool = asRecord(record?.tool)
        const callId = firstString(record, ['responseValueId', 'callId', 'id']) || firstString(tool, ['id'])
        if (!callId) return
        const current = tools.get(callId) || {
          callId,
          toolName: firstString(tool, ['toolName', 'functionName', 'name']) || firstString(record, ['toolName', 'name']) || 'FastGPT tool',
          params: '',
        }
        const fragment = firstString(tool, ['params']) ||
          (record?.arguments !== undefined ? JSON.stringify(record.arguments) : '')
        if (current.params.length < MAX_TOOL_PARAMS_LENGTH) {
          current.params += fragment.slice(0, MAX_TOOL_PARAMS_LENGTH - current.params.length)
        }
        tools.set(callId, current)
        return
      }

      if (event === 'toolResponse') {
        const tool = asRecord(record?.tool)
        const callId = firstString(record, ['responseValueId', 'callId', 'id']) || firstString(tool, ['id']) || `tool-${searches.size + 1}`
        const current = tools.get(callId) || {
          callId,
          toolName: firstString(tool, ['toolName', 'functionName', 'name']) || firstString(record, ['toolName', 'name']) || 'FastGPT tool',
          params: '',
        }
        const responseText = firstString(tool, ['response']) || ''
        const boundedResponseText = responseText.slice(0, MAX_TOOL_RESPONSE_LENGTH)
        const parsedResponse = boundedResponseText
          ? parseLooseJson(boundedResponseText)
          : record?.result
        const found = [...new Map([
          ...extractRawCitations(boundedResponseText),
          ...extractStructuredCitations(parsedResponse),
          ...extractStructuredCitations(record?.result),
        ].map(citation => [`${citation.id}|${citation.sourceName}`, citation])).values()]
        addCitations(found)
        const params = parseLooseJson(current.params)
        addSearch(callId, current.toolName, collectQueryValues(params), found.length)
        return
      }

      if (event === 'flowResponses') {
        const envelope = asRecord(payload)
        const nodes = Array.isArray(payload)
          ? payload
          : Array.isArray(envelope?.responseData)
            ? envelope.responseData
            : Array.isArray(envelope?.flowResponses)
              ? envelope.flowResponses
              : []
        for (const nodeValue of nodes) {
          const node = asRecord(nodeValue)
          if (!node) continue
          const found = extractStructuredCitations(node)
          addCitations(found)
          const moduleType = firstString(node, ['moduleType', 'type']) || ''
          if (/dataset|knowledge|search|retriev/i.test(moduleType)) {
            const callId = firstString(node, ['nodeId', 'id']) || `node-${searches.size + 1}`
            addSearch(
              callId,
              firstString(node, ['moduleName', 'name']) || moduleType,
              collectQueryValues(node),
              found.length
            )
          }
        }
      }
    },

    snapshot(): AiAnswerEvidence {
      return {
        version: 1,
        provider: 'fastgpt',
        searches: [...searches.values()],
        citations: [...citations.values()],
      }
    },
  }
}
