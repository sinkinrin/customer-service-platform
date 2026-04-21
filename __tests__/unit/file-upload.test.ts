import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileUpload } from '@/lib/hooks/use-file-upload'

function createFile(name: string, content: string) {
  return new File([content], name, { type: 'text/plain' })
}

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rebuilds the submission form after removing an uploaded file', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 101, form_id: 'form-a' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 102, form_id: 'form-a' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 202, form_id: 'form-b' } }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useFileUpload())

    await act(async () => {
      await result.current.addFiles([createFile('first.txt', 'a'), createFile('second.txt', 'b')])
    })

    act(() => {
      result.current.removeFile(0)
    })

    let formId: string | null = null
    await act(async () => {
      formId = await result.current.getFormId()
    })

    expect(formId).toBe('form-b')
    expect(result.current.uploadedFiles).toHaveLength(1)
    expect(result.current.uploadedFiles[0].file.name).toBe('second.txt')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not write an upload result into the wrong visible file after deletion', async () => {
    let resolveFirstUpload: ((value: unknown) => void) | undefined
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstUpload = resolve
          })
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 202, form_id: 'form-z' } }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useFileUpload())
    const uploadPromise = act(async () => {
      await result.current.addFiles([createFile('first.txt', 'a'), createFile('second.txt', 'b')])
    })

    act(() => {
      result.current.removeFile(0)
    })

    resolveFirstUpload?.({
      ok: true,
      json: async () => ({ data: { id: 101, form_id: 'form-z' } }),
    })

    await uploadPromise

    expect(result.current.uploadedFiles).toHaveLength(1)
    expect(result.current.uploadedFiles[0].file.name).toBe('second.txt')
    expect(result.current.uploadedFiles[0].attachmentId).toBe(202)
  })
})
