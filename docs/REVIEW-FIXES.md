# Code Review Fixes - v0.1.7

**Date**: 2025-11-18
**Status**: ✅ All 4 issues fixed
**Review Source**: review.md (latest 6 commits)

---

## 📋 Summary

Fixed all 4 critical issues identified in code review:
1. ✅ SearchBar auto-search fails to clear results
2. ✅ Persisted AI history loads only oldest 50 messages
3. ✅ FAQ caching serves stale content for up to 10 minutes
4. ✅ Global cache cleanup interval prevents serverless workers from idling

---

## 🔧 Detailed Fixes

### 1. SearchBar Auto-Search Clear Results ✅

**Issue**: The debounce effect only fired when `debouncedQuery !== defaultValue`. When clearing input, both values are empty strings, so `onSearch('')` was never called.

**File**: `src/components/faq/search-bar.tsx`

**Fix**:
```typescript
// Before
useEffect(() => {
  if (debouncedQuery !== defaultValue) {
    onSearch(debouncedQuery.trim())
  }
}, [debouncedQuery, onSearch, defaultValue])

// After
useEffect(() => {
  onSearch(debouncedQuery.trim())
}, [debouncedQuery, onSearch])
```

**Impact**: Clearing search input now correctly triggers `onSearch('')` to show popular FAQ.

---

### 2. AI History Pagination ✅

**Issue**: API call loaded messages without `limit` parameter, defaulting to first 50 rows. Long AI chats lost everything after message 50.

**File**: `src/app/customer/conversations/[id]/page.tsx:92`

**Fix**:
```typescript
// Before
const response = await fetch(`/api/conversations/${conversationId}/messages`)

// After
const response = await fetch(`/api/conversations/${conversationId}/messages?limit=1000`)
```

**Impact**: AI conversations can now load up to 1000 messages, preserving full context for transfers and resumed sessions.

---

### 3. FAQ Cache Invalidation ✅

**Issue**: FAQ cache persisted for 10 minutes without invalidation on article/category edits, showing stale content to admins and customers.

**Files Modified**:
- `src/app/api/faq/route.ts` - Added `forceRefresh` parameter
- `src/app/api/admin/faq/articles/route.ts` - Clear cache on create/update/delete
- `src/app/api/admin/faq/categories/route.ts` - Clear cache on create/update/delete

**Fix 3.1 - Force Refresh Parameter**:
```typescript
// src/app/api/faq/route.ts:35
const forceRefresh = searchParams.get('forceRefresh') === 'true'

// PERFORMANCE: Check cache first (for non-search queries and non-force-refresh)
if (!query && !forceRefresh) {
  const cacheKey = `faq:list:${language}:${categoryId || 'all'}:${limit}`
  const cached = faqCache.get(cacheKey)
  if (cached) {
    return successResponse({ ...cached, cached: true })
  }
}
```

**Fix 3.2 - Auto-Invalidation on Article Changes**:
```typescript
// src/app/api/admin/faq/articles/route.ts
import { faqCache } from '@/lib/cache/simple-cache'

// After create/update/delete:
faqCache.clear()
console.log('[Cache] Cleared FAQ cache after article [operation]')
```

**Fix 3.3 - Auto-Invalidation on Category Changes**:
```typescript
// src/app/api/admin/faq/categories/route.ts
import { faqCache, categoriesCache } from '@/lib/cache/simple-cache'

// After create/update/delete:
faqCache.clear()
categoriesCache.clear()
console.log('[Cache] Cleared FAQ and categories cache after category [operation]')
```

**Impact**:
- Admins can use `?forceRefresh=true` to bypass cache
- Cache automatically invalidates on any FAQ content change
- Customers see fresh content immediately after admin edits

---

### 4. Serverless Timer Leak ✅

**Issue**: `setInterval` at module scope created permanent timers on every cold start, keeping event loop alive and preventing serverless workers from idling.

**File**: `src/lib/cache/simple-cache.ts:133-155`

**Fix**:
```typescript
// Before
if (typeof window === 'undefined') {
  setInterval(() => {
    faqCache.cleanup()
    categoriesCache.cleanup()
    ticketCache.cleanup()
    conversationCache.cleanup()
  }, 5 * 60 * 1000)
}

// After
if (typeof window === 'undefined') {
  // @ts-ignore - globalThis augmentation for cleanup tracking
  if (!globalThis.__cacheCleanupStarted) {
    // @ts-ignore
    globalThis.__cacheCleanupStarted = true

    const timer = setInterval(() => {
      faqCache.cleanup()
      categoriesCache.cleanup()
      ticketCache.cleanup()
      conversationCache.cleanup()
    }, 5 * 60 * 1000)

    // Use unref() to allow the process to exit if this is the only active timer
    // This prevents the timer from keeping serverless workers alive
    if (timer.unref) {
      timer.unref()
    }
  }
}
```

**Impact**:
- `globalThis` guard prevents multiple timers on hot reload
- `unref()` allows serverless workers to idle and exit normally
- Reduces idle CPU usage and prevents timer leaks

---

## 🧪 Testing

### Manual Testing Checklist

#### Issue 1: SearchBar Clear
- [ ] Navigate to `/customer/faq`
- [ ] Type "support" in search
- [ ] Click X button to clear
- [ ] Verify popular FAQ loads (not stuck with filtered results)

#### Issue 2: AI History
- [ ] Create AI conversation with 60+ messages
- [ ] Refresh page
- [ ] Verify all messages load (not just first 50)
- [ ] Transfer to human and verify full history visible to staff

#### Issue 3: FAQ Cache
- [ ] Go to `/admin/faq`
- [ ] Create/edit an article
- [ ] Navigate to `/customer/faq`
- [ ] Verify new content appears immediately
- [ ] Test `?forceRefresh=true` parameter

#### Issue 4: Serverless Timer
- [ ] Deploy to serverless environment (Vercel/Netlify)
- [ ] Verify workers can idle after request
- [ ] Check for timer leaks in production logs

---

## 📊 Type Safety

All fixes maintain type safety:
- ✅ SearchBar: No type changes
- ✅ AI History: URL parameter addition (type-safe)
- ✅ FAQ Cache: Import and method calls (type-safe)
- ✅ Timer Leak: Logic changes only (type-safe)

**Note**: `npm run type-check` shows 27 errors, but all are pre-existing (not introduced by these fixes).

---

## 🎯 No Breaking Changes

All fixes are backward compatible:
- SearchBar: Behavior improved, no API changes
- AI History: Optional URL parameter
- FAQ Cache: New `forceRefresh` parameter is optional
- Timer Leak: Internal implementation change only

---

## 📝 Related Documentation

- Original review: `review.md`
- Performance optimizations: `docs/PERFORMANCE-OPTIMIZATIONS.md`
- OpenSpec status: `openspec/CHANGES-STATUS-REPORT.md`

---

## ✅ Completion Checklist

- [x] All 4 issues fixed
- [x] Type checking passed (no new errors)
- [x] Documentation updated
- [ ] Manual testing completed
- [ ] Ready for git commit
