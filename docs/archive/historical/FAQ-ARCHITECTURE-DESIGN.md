# FAQ Architecture Design

**Document Version**: 1.0
**Date**: 2025-01-06
**Status**: ~~Design Phase~~ **SUPERSEDED**

> ## ⚠️ Important Note (2026-01-21)
>
> **This design document is outdated.** The FAQ system was NOT implemented using Zammad Knowledge Base.
>
> ### Current Implementation
>
> The FAQ system uses **Prisma local database** instead of Zammad KB:
>
> | Component | Implementation |
> |-----------|----------------|
> | Data Storage | Prisma models: `FaqCategory`, `FaqArticle`, `FaqArticleTranslation`, `FaqRating` |
> | API Routes | `/api/faq`, `/api/faq/categories`, `/api/faq/[id]`, `/api/faq/[id]/rating` |
> | Admin Routes | `/api/admin/faq/*` for CRUD operations |
> | Database | SQLite (dev) / PostgreSQL (prod) |
> | Multi-language | `FaqArticleTranslation` model with locale field |
>
> See [DATABASE.md](./DATABASE.md) for the actual schema.
>
> ---
>
> *The original design below is preserved for historical reference.*

---

## Executive Summary (Original Design)

This document outlines the architecture for integrating Zammad Knowledge Base (KB) into the Customer Service Platform's FAQ system. The design addresses the current token permission issue and provides a comprehensive solution for multi-language FAQ content delivery.

## Current Status

### Issues Identified
1. **Token Permission Error**: Current Zammad API token lacks `knowledge_base.reader` permission
2. **FAQ Pages Show Empty State**: "No articles available" due to API authorization failure
3. **API Error**: `GET /api/faq/categories error: Error: Token authorization failed.`

### Existing Implementation
- Frontend FAQ pages exist at `src/app/(customer)/faq/page.tsx`
- Basic API routes exist at `src/app/api/faq/` and `src/app/api/faq/categories/`
- ZammadClient has KB methods: `searchKnowledgeBase`, `getKnowledgeBaseCategories`, `getKnowledgeBaseAnswer`

## Zammad Knowledge Base API Research

### API Endpoints

#### 1. Knowledge Base Overview
```http
POST /api/v1/knowledge_bases/init
```
- **Purpose**: Get complete KB structure with all categories, answers, and translations
- **Permission**: `knowledge_base.reader` or `knowledge_base.editor`
- **Response**: Complete KB data including categories, answers, translations, locales

#### 2. List Categories
```http
GET /api/v1/knowledge_base/categories
```
- **Purpose**: Get all KB categories
- **Permission**: `knowledge_base.reader`
- **Response**: Array of category objects with translations and answer IDs

#### 3. List Answers
```http
GET /api/v1/knowledge_base/answers
```
- **Purpose**: Get all KB answers (articles)
- **Permission**: `knowledge_base.reader`
- **Response**: Array of answer objects with translations and content

#### 4. Get Specific Answer
```http
GET /api/v1/knowledge_base/answers/{id}
```
- **Purpose**: Get detailed answer content
- **Permission**: `knowledge_base.reader`
- **Response**: Answer object with full content and translations

#### 5. Get Locales
```http
GET /api/v1/knowledge_base/locales
```
- **Purpose**: Get available KB locales
- **Permission**: `knowledge_base.reader`
- **Response**: Array of locale objects with language mappings

### Data Structure

#### Knowledge Base
```typescript
interface KnowledgeBase {
  id: number
  iconset: string
  color_highlight: string
  color_header: string
  homepage_layout: 'grid' | 'list'
  category_layout: 'grid' | 'list'
  active: boolean
  translation_ids: number[]
  kb_locale_ids: number[]
  category_ids: number[]
  answer_ids: number[]
}
```

#### Category
```typescript
interface KnowledgeBaseCategory {
  id: number
  knowledge_base_id: number
  parent_id: number | null
  category_icon: string
  position: number
  translation_ids: number[]
  answer_ids: number[]
  child_ids: number[]
  permissions_effective: Permission[]
}
```

#### Answer
```typescript
interface KnowledgeBaseAnswer {
  id: number
  category_id: number
  position: number
  archived_at: string | null
  internal_at: string | null
  published_at: string | null
  promoted: boolean
  translation_ids: number[]
  attachments: Attachment[]
  tags: string[]
}
```

#### Translation
```typescript
interface KnowledgeBaseAnswerTranslation {
  id: number
  answer_id: number
  title: string
  kb_locale_id: number
  content_id: number
  created_at: string
  updated_at: string
}
```

### Multi-Language Support

Zammad KB supports multiple locales via `kb_locale_id`:
- Each answer has translations for different locales
- Locale mapping: `system_locale_id` → `kb_locale_id`
- Platform languages (en, zh-CN, fr, es, ru, pt) need to map to Zammad locales

## Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ FAQ Search   │  │ FAQ Browse   │  │ FAQ Detail   │          │
│  │ Component    │  │ Component    │  │ Component    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ /api/faq     │  │ /api/faq/    │  │ /api/faq/    │          │
│  │              │  │ categories   │  │ [id]         │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Zammad Client Layer                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ZammadClient (src/lib/zammad/client.ts)                 │   │
│  │  - searchKnowledgeBase()                                 │   │
│  │  - getKnowledgeBaseCategories()                          │   │
│  │  - getKnowledgeBaseAnswer()                              │   │
│  │  - getKnowledgeBaseInit() [NEW]                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Zammad Knowledge Base API                     │
│  http://172.16.40.22:8080/api/v1/knowledge_bases/               │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

#### 1. FAQ Search Flow
```
User Input → FAQ Search Component → /api/faq?q=query&locale=en
  → ZammadClient.searchKnowledgeBase()
  → Zammad API: POST /api/v1/knowledge_bases/init
  → Filter answers by query and locale
  → Return formatted results
  → Display in UI
```

#### 2. FAQ Browse Flow
```
Page Load → FAQ Browse Component → /api/faq/categories?locale=en
  → ZammadClient.getKnowledgeBaseCategories()
  → Zammad API: GET /api/v1/knowledge_base/categories
  → Filter by locale and published status
  → Return category tree with answer counts
  → Display category grid/list
```

#### 3. FAQ Detail Flow
```
Article Click → FAQ Detail Component → /api/faq/[id]?locale=en
  → ZammadClient.getKnowledgeBaseAnswer(id)
  → Zammad API: GET /api/v1/knowledge_base/answers/{id}
  → Get translation for locale
  → Return article with content
  → Display article with related articles
```

## Implementation Plan

### Phase 1: Fix Token Permissions (IMMEDIATE)
**Priority**: HIGH  
**Estimated Time**: 1 hour

**Tasks**:
1. Access Zammad admin panel at http://172.16.40.22:8080
2. Navigate to Admin → API → Tokens
3. Find existing token: `gfgNF40pP1WjbDBMM9Jftwi2UIgOt9fze9WiNy3kxSb5akK4-mcV1F3ef3fJZ3Zt`
4. Add permission: `knowledge_base.reader`
5. Save changes
6. Test API access: `GET /api/v1/knowledge_bases/init`

**Verification**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://172.16.40.22:8080/api/v1/knowledge_bases/init
```

### Phase 2: Update Zammad Client (1-2 hours)
**Priority**: HIGH

**Files to Modify**:
- `src/lib/zammad/client.ts`
- `src/lib/zammad/types.ts`

**New Methods**:
```typescript
// Add to ZammadClient class
async getKnowledgeBaseInit(): Promise<KnowledgeBaseInit>
async getKnowledgeBaseAnswers(): Promise<KnowledgeBaseAnswer[]>
async getKnowledgeBaseLocales(): Promise<KnowledgeBaseLocale[]>
```

### Phase 3: Update API Routes (2-3 hours)
**Priority**: HIGH

**Files to Modify**:
- `src/app/api/faq/route.ts` - Search FAQ articles
- `src/app/api/faq/categories/route.ts` - Get categories
- `src/app/api/faq/[id]/route.ts` - Get specific article

**Implementation Details**: See detailed code in next section

### Phase 4: Frontend Updates (2-3 hours)
**Priority**: MEDIUM

**Files to Modify**:
- `src/app/(customer)/faq/page.tsx` - Main FAQ page
- Create `src/components/faq/faq-article-card.tsx` - Article card component
- Create `src/components/faq/faq-category-card.tsx` - Category card component

### Phase 5: Caching Strategy (1-2 hours)
**Priority**: LOW

**Implementation**:
- Use Next.js Route Handlers with `revalidate` option
- Cache KB init data for 5 minutes
- Cache individual articles for 10 minutes
- Implement ISR (Incremental Static Regeneration) for article pages

## Detailed Implementation

### API Route: /api/faq/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { zammadClient } from '@/lib/zammad/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const locale = searchParams.get('locale') || 'en'
    
    // Get KB init data (includes all categories, answers, translations)
    const kbData = await zammadClient.getKnowledgeBaseInit()
    
    // Map locale to kb_locale_id
    const kbLocale = kbData.KnowledgeBaseLocale.find(
      (l) => l.system_locale_id === getSystemLocaleId(locale)
    )
    
    if (!kbLocale) {
      return NextResponse.json({ articles: [], total: 0 })
    }
    
    // Filter answers by locale and published status
    const answers = Object.values(kbData.KnowledgeBaseAnswer).filter(
      (answer) => answer.published_at && !answer.archived_at
    )
    
    // Get translations for the locale
    const translations = Object.values(kbData.KnowledgeBaseAnswerTranslation)
      .filter((t) => t.kb_locale_id === kbLocale.id)
    
    // Search in translations
    const results = translations
      .filter((t) => {
        if (!query) return true
        return (
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          // Note: body content needs to be fetched separately
          false
        )
      })
      .map((t) => {
        const answer = answers.find((a) => a.id === t.answer_id)
        const category = kbData.KnowledgeBaseCategory[answer?.category_id || 0]
        
        return {
          id: answer?.id,
          title: t.title,
          category_id: answer?.category_id,
          category_name: getCategoryName(category, kbLocale.id, kbData),
          promoted: answer?.promoted,
          updated_at: t.updated_at,
        }
      })
    
    return NextResponse.json({
      articles: results,
      total: results.length,
    })
  } catch (error) {
    console.error('GET /api/faq error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch FAQ articles' },
      { status: 500 }
    )
  }
}
```

## Testing Strategy

### Unit Tests
- Test locale mapping functions
- Test data transformation functions
- Test error handling

### Integration Tests
- Test API routes with mock Zammad responses
- Test frontend components with mock API data

### E2E Tests (Playwright)
- Test FAQ search functionality
- Test FAQ browse by category
- Test FAQ article detail view
- Test multi-language switching

## Rollout Plan

1. **Week 1**: Fix token permissions, update Zammad client
2. **Week 2**: Update API routes, test with Postman/curl
3. **Week 3**: Update frontend components, E2E testing
4. **Week 4**: Performance optimization, caching implementation

## Success Metrics

- FAQ pages load without errors
- Search returns relevant results
- Multi-language support works correctly
- Page load time < 2 seconds
- API response time < 500ms

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token permission not granted | HIGH | Contact Zammad admin immediately |
| Locale mapping incorrect | MEDIUM | Create comprehensive locale mapping table |
| Performance issues | MEDIUM | Implement caching and pagination |
| Missing translations | LOW | Show fallback language (English) |

## Appendix

### Locale Mapping Table

| Platform Locale | Zammad system_locale_id | Notes |
|----------------|------------------------|-------|
| en | 1 | English (default) |
| zh-CN | TBD | Simplified Chinese |
| fr | TBD | French |
| es | TBD | Spanish |
| ru | TBD | Russian |
| pt | TBD | Portuguese |

*Note: Actual system_locale_id values need to be retrieved from Zammad API*

### References

- Zammad Knowledge Base API Documentation: https://docs.zammad.org/en/latest/api/knowledgebase/
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Project ZAMMAD-INTEGRATION.md: See existing integration documentation

