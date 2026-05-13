# AI Chat First Load Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make opening AI chat feel instant by avoiding database writes and nonessential reads on first page load.

**Architecture:** Treat a new AI chat as a client-side draft until the user sends the first message. Only materialize a database conversation when there is content to save, and create the real conversation plus the first customer message in one server operation to avoid orphan empty conversations. Keep existing history behavior for real conversation IDs, and keep the 30-minute reuse path.

**Tech Stack:** Next.js App Router, React client components, Zustand, Prisma/PostgreSQL, Vitest.

---

## File Map

- Modify `src/lib/constants/conversation.ts`
  - Add a single draft conversation route/id constant.
- Modify `src/app/customer/conversations/page.tsx`
  - Reuse recent active conversation when available.
  - Otherwise route to draft chat without POST.
- Modify `src/components/conversation/conversation-header.tsx`
  - Make the "new conversation" button route to draft chat instead of creating an empty database conversation.
- Modify `src/app/customer/conversations/[id]/page.tsx`
  - Support draft id.
  - Skip history/message API calls in draft mode.
  - Materialize draft on first send using a single server operation.
  - Use the materialized conversation id for message persistence, streaming, rating, and cache writes.
- Modify `src/app/api/conversations/route.ts`
  - Support creating a conversation with an initial message in one request.
- Modify `src/lib/ai-conversation-service.ts`
  - Add a transaction helper for conversation + first message materialization.
- Modify `src/lib/hooks/use-conversation.ts`
  - Keep `include_total=false` for history messages.
- Modify `src/app/api/conversations/[id]/messages/route.ts`
  - Keep optional `include_total=false`.
- Modify tests:
  - `__tests__/components/conversations-entry-page.test.tsx`
  - `__tests__/components/conversation-header.test.tsx`
  - `__tests__/components/conversation-detail-history.test.tsx`
  - `__tests__/api/conversations-detail.test.ts`
  - `__tests__/api/conversations-list.test.ts`

---

## Task 1: Draft Route Instead Of POST On Open

**Files:**
- Modify: `src/lib/constants/conversation.ts`
- Modify: `src/app/customer/conversations/page.tsx`
- Test: `__tests__/components/conversations-entry-page.test.tsx`

- [ ] **Step 1: Write failing tests**

Add/adjust these expectations:

```ts
it('routes to draft chat without creating a conversation when there is no reusable recent conversation', async () => {
  render(<ConversationsPage />)

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/new')
  })
  expect(mockCreateConversation).not.toHaveBeenCalled()
})

it('reuses recent active conversation without creating a new one', async () => {
  sessionStorage.setItem('conversationLastVisitAt:user-1', String(Date.now()))
  mockConversations = [
    {
      id: 'conv-active',
      status: 'active',
      last_message_at: '2026-05-12T00:00:00.000Z',
      created_at: '2026-05-12T00:00:00.000Z',
    },
  ]

  render(<ConversationsPage />)

  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith('/customer/conversations/conv-active')
  })
  expect(mockCreateConversation).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test -- __tests__/components/conversations-entry-page.test.tsx
```

Expected: draft-route test fails because current code still calls `createConversation()`.

- [ ] **Step 3: Implement minimal route change**

Add constant:

```ts
export const DRAFT_CONVERSATION_ID = 'new'
```

Change entry page:

```ts
router.replace(`/customer/conversations/${DRAFT_CONVERSATION_ID}`)
```

Keep the recent active reuse branch before draft routing.

- [ ] **Step 4: Verify green**

Run:

```bash
npm run test -- __tests__/components/conversations-entry-page.test.tsx
```

Expected: all tests pass.

---

## Task 2: Header New Conversation Uses Draft Route

**Files:**
- Modify: `src/components/conversation/conversation-header.tsx`
- Test: `__tests__/components/conversation-header.test.tsx`

- [ ] **Step 1: Write failing test**

Add/adjust this test:

```ts
it('navigates to draft conversation without creating one', async () => {
  const user = userEvent.setup()
  render(<ConversationHeader />)

  await user.click(screen.getByRole('button', { name: /new/i }))

  expect(global.fetch).not.toHaveBeenCalledWith('/api/conversations', expect.anything())
  expect(mockPush).toHaveBeenCalledWith('/customer/conversations/new')
})
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test -- __tests__/components/conversation-header.test.tsx
```

Expected: fails because header currently posts `/api/conversations`.

- [ ] **Step 3: Implement header route change**

Change `ConversationHeader.handleNewConversation()`:

```ts
const handleNewConversation = () => {
  router.push(`/customer/conversations/${DRAFT_CONVERSATION_ID}`)
}
```

Remove `isCreating` state, `fetch('/api/conversations')`, and just-created marker writes from the header path.

- [ ] **Step 4: Verify green**

Run:

```bash
npm run test -- __tests__/components/conversation-header.test.tsx
```

Expected: pass.

---

## Task 3: Draft Detail Page Does Not Fetch History

**Files:**
- Modify: `src/app/customer/conversations/[id]/page.tsx`
- Test: `__tests__/components/conversation-detail-history.test.tsx`

- [ ] **Step 1: Write failing test**

Add test:

```ts
it('opens draft conversation without fetching messages or mark-read', async () => {
  currentConversationId = 'new'

  render(<ConversationDetailPage />)

  await waitFor(() => {
    expect(screen.getByTestId('message-input')).toBeTruthy()
  })
  expect(mockFetchHistoryMessages).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalledWith(
    '/api/conversations/new/mark-read',
    expect.anything()
  )
})
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test -- __tests__/components/conversation-detail-history.test.tsx -t "opens draft conversation"
```

Expected: fails because draft id currently behaves like a real conversation id.

- [ ] **Step 3: Implement draft branch**

In detail page:

```ts
const isDraftConversation = conversationId === DRAFT_CONVERSATION_ID
```

In message-loading effect, before cache/API work:

```ts
if (isDraftConversation) {
  setAiMessages([])
  setHistoryMessageOffset(0)
  setHistoryMessageHasMore(false)
  setIsInitialLoading(false)
  return
}
```

Use `isDraftConversation` in dependency list.

- [ ] **Step 4: Verify green**

Run:

```bash
npm run test -- __tests__/components/conversation-detail-history.test.tsx -t "opens draft conversation"
```

Expected: pass.

---

## Task 4: Server-Side Materialization Operation

**Files:**
- Modify: `src/app/api/conversations/route.ts`
- Modify: `src/lib/ai-conversation-service.ts`
- Test: `__tests__/api/conversations-list.test.ts`

- [ ] **Step 1: Write failing API test**

Add a test that posts an initial message:

```ts
it('creates a conversation and initial message in one request', async () => {
  vi.mocked(createAIConversationWithInitialMessage).mockResolvedValue({
    conversation: baseConversation,
    message: {
      id: 'msg_1',
      content: 'hello',
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
    },
  } as any)

  const request = createRequest('http://localhost:3000/api/conversations', {
    method: 'POST',
    body: JSON.stringify({
      initial_message: 'hello',
      initial_metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
    }),
  })

  const response = await POST(request)
  const payload = await response.json()

  expect(response.status).toBe(201)
  expect(payload.data.conversation.id).toBe('conv_1')
  expect(payload.data.message.id).toBe('msg_1')
})
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm run test -- __tests__/api/conversations-list.test.ts -t "creates a conversation and initial message"
```

Expected: fails because the endpoint does not return `{ conversation, message }`.

- [ ] **Step 3: Implement transaction helper**

Add helper in `src/lib/ai-conversation-service.ts`:

```ts
export async function createAIConversationWithInitialMessage(
  customerId: string,
  customerEmail: string,
  initialMessage: string,
  metadata: Record<string, any>
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`

    await tx.aiConversation.updateMany({
      where: { customerId, status: 'active' },
      data: { status: 'closed' },
    })

    const conversation = await tx.aiConversation.create({
      data: { customerId, customerEmail, status: 'active' },
    })

    const message = await tx.aiMessage.create({
      data: {
        conversationId: conversation.id,
        senderRole: 'customer',
        senderId: customerId,
        content: initialMessage,
        messageType: 'text',
        metadata: JSON.stringify(metadata),
      },
    })

    await tx.aiConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    })

    return {
      conversation,
      message: {
        ...message,
        metadata,
      },
    }
  })
}
```

- [ ] **Step 4: Implement API response**

In `POST /api/conversations`, when `initial_message` exists:

```ts
const result = await createAIConversationWithInitialMessage(
  user.id,
  user.email,
  validation.data.initial_message,
  validation.data.initial_metadata || { sender_name: user.full_name || user.email }
)

return successResponse({
  conversation: transformConversation(result.conversation, 1),
  message: transformMessage(result.message, user),
}, 201)
```

Keep empty-body callers compatible by returning the existing conversation object when no `initial_message` is passed.

- [ ] **Step 5: Verify green**

Run:

```bash
npm run test -- __tests__/api/conversations-list.test.ts -t "creates a conversation and initial message"
```

Expected: pass.

---

## Task 5: First Draft Send Uses Real Id Everywhere

**Files:**
- Modify: `src/app/customer/conversations/[id]/page.tsx`
- Test: `__tests__/components/conversation-detail-history.test.tsx`

- [ ] **Step 1: Write failing component test**

Mock `MessageInput` so the test can call `onSend`. Capture `sendStreamingRequest`.

```ts
it('creates a real conversation and first message only when first draft message is sent', async () => {
  currentConversationId = 'new'
  mockSendStreamingRequest.mockResolvedValue('ai reply')
  vi.mocked(global.fetch).mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/conversations') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            conversation: { id: 'conv-created' },
            message: {
              id: 'msg-user-1',
              content: 'hello',
              metadata: { aiMode: true, role: 'customer', aiChatMode: 'flash' },
              created_at: '2026-05-12T00:00:00.000Z',
            },
          },
        }),
      } as Response
    }
    return { ok: true, json: async () => ({ success: true, data: { id: 'msg-ai-1' } }) } as Response
  })

  render(<ConversationDetailPage />)

  await act(async () => {
    await capturedOnSend('hello')
  })

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/conversations',
    expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"initial_message":"hello"'),
    })
  )
  expect(global.fetch).not.toHaveBeenCalledWith('/api/conversations/new/messages', expect.anything())
  expect(mockSendStreamingRequest).toHaveBeenCalledWith(
    '/api/ai/chat',
    expect.objectContaining({ conversationId: 'conv-created' }),
    expect.any(String)
  )
})
```

- [ ] **Step 2: Add cache assertion**

In the same test or a second test:

```ts
expect(mockAppendHistoryMessageToCache).toHaveBeenCalledWith('conv-created', expect.any(Object))
expect(mockAppendHistoryMessageToCache).not.toHaveBeenCalledWith('new', expect.any(Object))
```

- [ ] **Step 3: Add rating assertion**

After materialized AI message exists:

```ts
expect(global.fetch).toHaveBeenCalledWith(
  '/api/conversations/conv-created/messages/msg-ai-1/rating',
  expect.objectContaining({ method: 'PUT' })
)
expect(global.fetch).not.toHaveBeenCalledWith(
  '/api/conversations/new/messages/msg-ai-1/rating',
  expect.anything()
)
```

- [ ] **Step 4: Verify red**

Run:

```bash
npm run test -- __tests__/components/conversation-detail-history.test.tsx -t "creates a real conversation and first message"
```

Expected: fails because current draft path has no materialized id logic.

- [ ] **Step 5: Implement effective conversation id**

Add local state:

```ts
const [materializedConversationId, setMaterializedConversationId] = useState<string | null>(null)
const effectiveConversationId = materializedConversationId || (isDraftConversation ? null : conversationId)
```

At start of `handleAIMessage`, after optimistic UI message:

```ts
let targetConversationId = effectiveConversationId
let persistedUserMsgId: string | null = null

if (!targetConversationId) {
  const materializeRes = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initial_message: trimmedContent,
      initial_metadata: { aiMode: true, role: 'customer', aiChatMode },
    }),
  })
  const materializeData = await materializeRes.json()
  if (!materializeRes.ok || !materializeData.success) {
    setAiMessages((prev) => prev.filter((msg) => msg.id !== newUserMessage.id))
    throw new Error('Failed to create conversation')
  }
  targetConversationId = materializeData.data.conversation.id
  persistedUserMsgId = materializeData.data.message.id
  setMaterializedConversationId(targetConversationId)
  appendHistoryMessageToCache(targetConversationId, materializeData.data.message)
} else {
  // keep existing POST /api/conversations/:id/messages path for real conversations
}
```

Use `targetConversationId` for:

- `/api/ai/chat` body `conversationId`
- AI response persistence URL
- `appendHistoryMessageToCache`
- `submitRating`
- `applyRatingToCache`
- `displayMessages[*].conversation_id`

After AI response is persisted:

```ts
if (isDraftConversation && targetConversationId) {
  router.replace(`/customer/conversations/${targetConversationId}`)
}
```

- [ ] **Step 6: Verify green**

Run:

```bash
npm run test -- __tests__/components/conversation-detail-history.test.tsx -t "creates a real conversation and first message"
```

Expected: pass.

---

## Task 6: Keep Existing History Fast Path

**Files:**
- Modify: `src/lib/hooks/use-conversation.ts`
- Modify: `src/app/api/conversations/[id]/messages/route.ts`
- Test: `__tests__/api/conversations-detail.test.ts`

- [ ] **Step 1: Preserve count-skipping test**

Keep this behavior:

```ts
expect(getConversationMessageCount).not.toHaveBeenCalled()
expect(payload.data.pagination.total).toBeNull()
```

- [ ] **Step 2: Verify**

Run:

```bash
npm run test -- __tests__/api/conversations-detail.test.ts
```

Expected: pass.

---

## Task 7: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Type check**

Run:

```bash
npm run type-check
```

Expected: exit 0.

- [ ] **Step 2: Focused tests**

Run:

```bash
npm run test -- __tests__/components/conversations-entry-page.test.tsx __tests__/components/conversation-header.test.tsx __tests__/components/conversation-detail-history.test.tsx __tests__/api/conversations-detail.test.ts __tests__/api/conversations-mark-read.test.ts __tests__/api/conversations-list.test.ts
```

Expected: all pass.

- [ ] **Step 3: Browser measurement**

Run a browser script or manual devtools check and confirm:

```txt
Open /customer/conversations with no reusable conversation:
- no POST /api/conversations before user sends first message
- no /messages request before user sends first message
- no /mark-read request on mount

Click header "new conversation":
- navigates to /customer/conversations/new
- no POST /api/conversations before user sends first message

Send first draft message:
- one POST /api/conversations with initial_message
- no POST /api/conversations/new/messages
- /api/ai/chat body uses the real conversation id
```

Expected first-open critical path:

```txt
/customer/conversations page load
router replace to /customer/conversations/new
render empty chat
```

Expected first-message critical path:

```txt
POST /api/conversations with initial_message
/api/ai/chat
POST /api/conversations/:id/messages for AI reply
```

---

## Decision

Implement this inline in the current session. The highest-value change is Task 1-5: draft chat plus atomic first-message materialization. The DB/index work already done helps remaining real conversation reads, but this plan removes the expensive write from page open entirely.
