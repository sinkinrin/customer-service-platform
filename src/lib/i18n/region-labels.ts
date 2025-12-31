import fs from 'fs'
import path from 'path'

import type { RegionValue } from '@/lib/constants/regions'

const labelCache = new Map<string, Record<string, string>>()

function loadLabels(locale: string): Record<string, string> {
  if (labelCache.has(locale)) {
    return labelCache.get(locale) as Record<string, string>
  }

  const filePath = path.join(process.cwd(), 'messages', `${locale}.json`)
  const raw = fs.readFileSync(filePath, 'utf-8')
  const messages = JSON.parse(raw)
  const labels = messages?.common?.regions ?? {}

  labelCache.set(locale, labels)
  return labels
}

export function getRegionLabelForLocale(
  region: RegionValue | 'unassigned',
  locale: string
): string {
  const labels = loadLabels(locale)
  return labels[region] || region
}
