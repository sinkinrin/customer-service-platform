import { describe, expect, it } from 'vitest'
import {
  createFastGPTEvidenceAccumulator,
  parseAiAnswerEvidence,
} from '@/lib/ai/fastgpt-evidence'

describe('FastGPT evidence extraction', () => {
  it('merges streamed tool parameters and extracts cites from a loose JSON response', () => {
    const accumulator = createFastGPTEvidenceAccumulator()
    const callId = 'call-dataset-1'

    accumulator.consume('toolCall', JSON.stringify({
      tool: {
        id: callId,
        toolName: 'DatasetSearch',
        functionName: 'dataset_search',
      },
      responseValueId: callId,
    }))
    accumulator.consume('toolParams', JSON.stringify({
      tool: { id: callId, params: '{"query":["login"' },
      responseValueId: callId,
    }))
    accumulator.consume('toolParams', JSON.stringify({
      tool: { id: callId, params: ',"SSO"]}' },
      responseValueId: callId,
    }))

    const looseResponse = '[{"result":{"cites":[{"id":"doc-1","sourceName":"Login Manual.pdf","updateTime":"2026-08-01","content":"line one\nline two"}]}}]'
    accumulator.consume('toolResponse', JSON.stringify({
      tool: { id: callId, response: looseResponse },
      responseValueId: callId,
    }))

    const evidence = accumulator.snapshot()

    expect(evidence.searches).toEqual([
      {
        callId,
        toolName: 'DatasetSearch',
        queries: ['login', 'SSO'],
        citationCount: 1,
      },
    ])
    expect(evidence.citations).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        sourceName: 'Login Manual.pdf',
        content: 'line one\nline two',
        updateTime: '2026-08-01',
      }),
    ])
  })

  it('supports top-level tool arguments/results and wrapped flow responses', () => {
    const accumulator = createFastGPTEvidenceAccumulator()

    accumulator.consume('toolCall', JSON.stringify({ callId: 'top-1', toolName: 'DatasetSearch' }))
    accumulator.consume('toolParams', JSON.stringify({
      callId: 'top-1',
      arguments: { query: ['redirect loop'] },
    }))
    accumulator.consume('toolResponse', JSON.stringify({
      callId: 'top-1',
      result: {
        cites: [{ id: 'top-doc', sourceName: 'Top Level Guide.md', content: 'Top-level citation.' }],
      },
    }))
    accumulator.consume('flowResponses', JSON.stringify({
      responseData: [{
        nodeId: 'node-1',
        moduleName: 'Knowledge Search',
        moduleType: 'datasetSearchNode',
        query: 'SSO callback',
        quoteList: [{ id: 'flow-doc', sourceName: 'Flow Guide.pdf', content: 'Wrapped flow citation.' }],
      }],
    }))

    const evidence = accumulator.snapshot()
    expect(evidence.searches).toEqual(expect.arrayContaining([
      expect.objectContaining({ callId: 'top-1', queries: ['redirect loop'], citationCount: 1 }),
      expect.objectContaining({ callId: 'node-1', queries: ['SSO callback'], citationCount: 1 }),
    ]))
    expect(evidence.citations.map(citation => citation.sourceName)).toEqual(
      expect.arrayContaining(['Top Level Guide.md', 'Flow Guide.pdf'])
    )
  })

  it('normalizes persisted evidence and rejects unrelated metadata', () => {
    expect(parseAiAnswerEvidence({ version: 2, provider: 'fastgpt' })).toBeNull()
    expect(parseAiAnswerEvidence({
      version: 1,
      provider: 'fastgpt',
      searches: [{ callId: 'c1', toolName: 'DatasetSearch', queries: ['login'], citationCount: 1 }],
      citations: [{ id: 'd1', sourceName: 'Guide.md', content: 'content' }],
    })).toEqual({
      version: 1,
      provider: 'fastgpt',
      searches: [{ callId: 'c1', toolName: 'DatasetSearch', queries: ['login'], citationCount: 1 }],
      citations: [{ id: 'd1', sourceName: 'Guide.md', content: 'content' }],
    })
  })
})
