import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiEvidenceDisclosure } from '@/components/conversation/ai-evidence-disclosure'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values?.count !== undefined ? `${key} ${values.count}` : key,
}))

describe('AiEvidenceDisclosure', () => {
  it('stays collapsed behind a small source button until staff opens it', async () => {
    const user = userEvent.setup()
    render(
      <AiEvidenceDisclosure
        evidence={{
          version: 1,
          provider: 'fastgpt',
          searches: [{ callId: 'c1', toolName: 'DatasetSearch', queries: ['login', 'SSO'], citationCount: 1 }],
          citations: [{ id: 'doc-1', sourceName: 'Login Guide.md', content: 'Use a private window.' }],
        }}
      />
    )

    expect(screen.getByRole('button', { name: 'buttonLabel 1' })).toBeInTheDocument()
    expect(screen.queryByText('Login Guide.md')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'buttonLabel 1' }))

    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('login')).toBeInTheDocument()
    expect(screen.getByText('SSO')).toBeInTheDocument()
    expect(screen.getByText('Login Guide.md')).toBeInTheDocument()
    expect(screen.getByText('Use a private window.')).toBeInTheDocument()
  })
})
