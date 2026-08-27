'use client'

import { useState } from 'react'
import { BookOpenText, Check, Copy, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { AiAnswerEvidence } from '@/lib/ai/fastgpt-evidence'
import { cn } from '@/lib/utils'

interface AiEvidenceDisclosureProps {
  evidence: AiAnswerEvidence
}

function buildClipboardText(evidence: AiAnswerEvidence) {
  const searches = evidence.searches
    .flatMap(search => search.queries)
    .filter(Boolean)
  const citations = evidence.citations.map((citation, index) => [
    `[${index + 1}] ${citation.sourceName}`,
    citation.id ? `ID: ${citation.id}` : '',
    citation.updateTime ? `Updated: ${citation.updateTime}` : '',
    citation.content,
  ].filter(Boolean).join('\n'))

  return [
    searches.length ? `Search queries:\n${searches.map(query => `- ${query}`).join('\n')}` : '',
    citations.length ? `Citations:\n\n${citations.join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n')
}

export function AiEvidenceDisclosure({ evidence }: AiEvidenceDisclosureProps) {
  const t = useTranslations('components.conversation.aiEvidence')
  const [copied, setCopied] = useState(false)
  const citationCount = evidence.citations.length
  const queries = [...new Set(evidence.searches.flatMap(search => search.queries))]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildClipboardText(evidence))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'ml-auto inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors',
            'border-violet-200/80 bg-violet-50/70 text-violet-700 hover:bg-violet-100',
            'dark:border-violet-800/80 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40'
          )}
          aria-label={t('buttonLabel', { count: citationCount })}
        >
          <BookOpenText className="h-3.5 w-3.5" />
          {t('button', { count: citationCount })}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 px-6 py-5 pr-12">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              <BookOpenText className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription className="mt-1">
                {t('description', { count: citationCount })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(100vh-12rem)] space-y-5 overflow-y-auto px-6 py-5">
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
              <Search className="h-3.5 w-3.5 text-violet-500" />
              {t('searches')}
            </div>
            {queries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {queries.map(query => (
                  <span
                    key={query}
                    className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {query}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noSearches')}</p>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-foreground">
                {t('citations', { count: citationCount })}
              </span>
              {(queries.length > 0 || citationCount > 0) && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t('copied') : t('copy')}
                </button>
              )}
            </div>

            {evidence.citations.length > 0 ? (
              <div className="space-y-3">
                {evidence.citations.map((citation, index) => (
                  <article
                    key={`${citation.id}:${citation.sourceName}`}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                            {index + 1}
                          </span>
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {citation.sourceName}
                          </h3>
                        </div>
                        <div className="mt-1.5 space-y-0.5 pl-7 font-mono text-[10px] text-muted-foreground">
                          {citation.id && <div className="break-all">{t('sourceId')}: {citation.id}</div>}
                          {citation.updateTime && <div>{t('updatedAt')}: {citation.updateTime}</div>}
                        </div>
                      </div>
                      {citation.score !== undefined && (
                        <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[10px] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {Math.round(citation.score * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-3 max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                      {citation.content || t('emptyContent')}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                {t('noCitations')}
              </div>
            )}
          </section>

          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            {t('feedbackHint')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
