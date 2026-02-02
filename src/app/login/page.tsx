import { redirect } from 'next/navigation'

type LoginAliasPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function LoginAliasPage({ searchParams }: LoginAliasPageProps) {
  const params = new URLSearchParams()

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'string') {
        params.set(key, value)
      } else if (Array.isArray(value)) {
        params.delete(key)
        for (const item of value) params.append(key, item)
      }
    }
  }

  const query = params.toString()
  redirect(`/auth/login${query ? `?${query}` : ''}`)
}
