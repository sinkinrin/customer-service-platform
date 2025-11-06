# 🔄 Business Flows

> Detailed business process flows for the Customer Service Platform

**Document Version**: 1.0  
**Last Updated**: 2025-10-27  
**Status**: ✅ Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-sales Consultation Flow](#pre-sales-consultation-flow)
3. [After-sales Support Flow](#after-sales-support-flow)
4. [Human Agent Handoff Flow](#human-agent-handoff-flow)
5. [Ticket Creation Flow](#ticket-creation-flow)
6. [FAQ Self-Service Flow](#faq-self-service-flow)
7. [Staff Workflow](#staff-workflow)

---

## 1. Overview

This document describes the core business processes of the Customer Service Platform. Each flow is illustrated with Mermaid diagrams and detailed step-by-step descriptions.

### Key Principles

1. **Customer-First**: Minimize friction in customer journey
2. **Self-Service Priority**: Encourage FAQ usage before human handoff
3. **Contextual Handoff**: Preserve conversation history when escalating
4. **Flexible Routing**: Support both automatic and manual assignment
5. **Continuous Improvement**: Track metrics to optimize flows

---

## 2. Pre-sales Consultation Flow

### 2.1 Flow Diagram

```mermaid
flowchart TD
    Start([Customer Visits Platform]) --> SelectType{Select Business Type}
    SelectType -->|Pre-sales| PreSales[Enter Pre-sales Portal]
    
    PreSales --> ShowFAQ[Display FAQ Recommendations]
    ShowFAQ --> CustomerAction{Customer Action}
    
    CustomerAction -->|Browse FAQ| BrowseFAQ[Browse FAQ Categories]
    CustomerAction -->|Search| SearchFAQ[Search FAQ with Keywords]
    CustomerAction -->|Type Question| TypeQuestion[Type in Input Field]
    
    BrowseFAQ --> ViewFAQ[View FAQ Answer]
    SearchFAQ --> ViewFAQ
    TypeQuestion --> KeywordMatch[Keyword Matching]
    KeywordMatch --> ShowSuggestions[Show FAQ Suggestions]
    ShowSuggestions --> ViewFAQ
    
    ViewFAQ --> Resolved{Problem Resolved?}
    Resolved -->|Yes| RateFAQ[Rate FAQ Helpfulness]
    RateFAQ --> End([End Session])
    
    Resolved -->|No| RequestHuman[Click 'Contact Human Agent']
    RequestHuman --> QueueCheck{Staff Available?}
    
    QueueCheck -->|Yes| AssignStaff[Assign to Available Staff]
    QueueCheck -->|No| EnterQueue[Enter Waiting Queue]
    EnterQueue --> ShowPosition[Show Queue Position]
    ShowPosition --> WaitForStaff[Wait for Staff]
    WaitForStaff --> AssignStaff
    
    AssignStaff --> StartConversation[Start Conversation]
    StartConversation --> ChatLoop[Real-time Chat]
    ChatLoop --> StaffHelp{Issue Resolved?}
    
    StaffHelp -->|Yes| CloseConv[Staff Closes Conversation]
    StaffHelp -->|No| ContinueChat[Continue Conversation]
    ContinueChat --> ChatLoop
    
    CloseConv --> RateConv[Customer Rates Conversation]
    RateConv --> End
    
    style PreSales fill:#e1f5ff
    style RequestHuman fill:#fff4e6
    style AssignStaff fill:#e8f5e9
    style CloseConv fill:#f3e5f5
```

### 2.2 Detailed Steps

#### Phase 1: Entry and Self-Service
1. **Customer visits platform** → Lands on homepage
2. **Selects "Pre-sales Consultation"** → Enters pre-sales portal
3. **Views FAQ recommendations** → System shows top 5 relevant FAQs based on business type
4. **Customer chooses action**:
   - **Option A**: Browse FAQ categories
   - **Option B**: Search FAQ with keywords
   - **Option C**: Type question in input field

#### Phase 2: FAQ Interaction
5. **If browsing**: Navigate through categories → Select FAQ item → View answer
6. **If searching**: Enter keywords → View search results → Select FAQ item → View answer
7. **If typing**: System performs real-time keyword matching → Shows suggestions → Customer clicks suggestion → View answer

#### Phase 3: Resolution or Escalation
8. **Problem resolved?**
   - **Yes**: Customer rates FAQ helpfulness → Session ends
   - **No**: Customer clicks "Contact Human Agent" → Proceed to Phase 4

#### Phase 4: Human Agent Handoff
9. **System checks staff availability**:
   - **Staff available**: Immediately assign conversation
   - **No staff available**: Add to waiting queue → Show queue position
10. **Staff accepts conversation** → Conversation starts
11. **Real-time chat** → Staff provides assistance
12. **Issue resolved** → Staff closes conversation
13. **Customer rates conversation** → Session ends

### 2.3 Business Rules

| Rule | Description |
|------|-------------|
| **BR-PS-001** | Pre-sales customers **cannot** create tickets |
| **BR-PS-002** | FAQ must be shown before allowing human handoff |
| **BR-PS-003** | Conversation history is preserved when escalating to human agent |
| **BR-PS-004** | Maximum queue wait time: 5 minutes (configurable) |
| **BR-PS-005** | If wait time exceeds limit, offer callback option |

---

## 3. After-sales Support Flow

### 3.1 Flow Diagram

```mermaid
flowchart TD
    Start([Customer Visits Platform]) --> SelectType{Select Business Type}
    SelectType -->|After-sales| AfterSales[Enter After-sales Portal]
    
    AfterSales --> ShowFAQ[Display FAQ Recommendations]
    ShowFAQ --> CustomerAction{Customer Action}
    
    CustomerAction -->|Browse FAQ| BrowseFAQ[Browse FAQ Categories]
    CustomerAction -->|Search| SearchFAQ[Search FAQ with Keywords]
    CustomerAction -->|Type Question| TypeQuestion[Type in Input Field]
    CustomerAction -->|Create Ticket| DirectTicket[Go to Ticket Creation]
    
    BrowseFAQ --> ViewFAQ[View FAQ Answer]
    SearchFAQ --> ViewFAQ
    TypeQuestion --> KeywordMatch[Keyword Matching]
    KeywordMatch --> ShowSuggestions[Show FAQ Suggestions]
    ShowSuggestions --> ViewFAQ
    
    ViewFAQ --> Resolved{Problem Resolved?}
    Resolved -->|Yes| RateFAQ[Rate FAQ Helpfulness]
    RateFAQ --> End([End Session])
    
    Resolved -->|No| ChooseAction{Choose Action}
    ChooseAction -->|Contact Human| RequestHuman[Click 'Contact Human Agent']
    ChooseAction -->|Create Ticket| DirectTicket
    
    RequestHuman --> QueueCheck{Staff Available?}
    QueueCheck -->|Yes| AssignStaff[Assign to Available Staff]
    QueueCheck -->|No| EnterQueue[Enter Waiting Queue]
    EnterQueue --> WaitForStaff[Wait for Staff]
    WaitForStaff --> AssignStaff
    
    AssignStaff --> StartConversation[Start Conversation]
    StartConversation --> ChatLoop[Real-time Chat]
    ChatLoop --> StaffDecision{Staff Decision}
    
    StaffDecision -->|Resolve in Chat| CloseConv[Close Conversation]
    StaffDecision -->|Create Ticket| CreateTicketFromChat[Create Ticket from Chat]
    StaffDecision -->|Continue| ContinueChat[Continue Conversation]
    ContinueChat --> ChatLoop
    
    CreateTicketFromChat --> TicketCreated[Ticket Created]
    DirectTicket --> FillForm[Fill Ticket Form]
    FillForm --> SubmitTicket[Submit Ticket]
    SubmitTicket --> TicketCreated
    
    TicketCreated --> NotifyCustomer[Notify Customer]
    NotifyCustomer --> StaffProcess[Staff Processes Ticket]
    StaffProcess --> UpdateStatus[Update Ticket Status]
    UpdateStatus --> TicketResolved{Ticket Resolved?}
    
    TicketResolved -->|No| StaffProcess
    TicketResolved -->|Yes| CloseTicket[Close Ticket]
    CloseTicket --> RateTicket[Customer Rates Ticket]
    RateTicket --> End
    
    CloseConv --> RateConv[Customer Rates Conversation]
    RateConv --> End
    
    style AfterSales fill:#e1f5ff
    style DirectTicket fill:#fff4e6
    style CreateTicketFromChat fill:#fff4e6
    style TicketCreated fill:#e8f5e9
    style CloseTicket fill:#f3e5f5
```

### 3.2 Detailed Steps

#### Phase 1: Entry and Self-Service
1. **Customer visits platform** → Lands on homepage
2. **Selects "After-sales Support"** → Enters after-sales portal
3. **Views FAQ recommendations** → System shows top 5 relevant FAQs
4. **Customer chooses action**:
   - **Option A**: Browse FAQ categories
   - **Option B**: Search FAQ with keywords
   - **Option C**: Type question in input field
   - **Option D**: Directly create ticket (skip FAQ)

#### Phase 2: FAQ Interaction (if chosen)
5-7. Same as Pre-sales flow

#### Phase 3: Resolution or Escalation
8. **Problem resolved?**
   - **Yes**: Customer rates FAQ helpfulness → Session ends
   - **No**: Customer chooses next action:
     - **Option A**: Contact human agent
     - **Option B**: Create ticket

#### Phase 4A: Human Agent Path
9-13. Same as Pre-sales flow
14. **During conversation, staff can**:
    - Resolve issue in chat → Close conversation
    - Create ticket from chat → Proceed to Phase 5
    - Continue conversation

#### Phase 4B: Direct Ticket Creation
15. **Customer fills ticket form**:
    - Title, description, priority, category
    - Attach files (screenshots, logs)
16. **Submit ticket** → Proceed to Phase 5

#### Phase 5: Ticket Processing
17. **Ticket created** → System generates ticket ID
18. **Notify customer** → Email + in-app notification
19. **Staff processes ticket**:
    - Investigate issue
    - Add internal notes
    - Update status (new → in-progress → resolved)
    - Add public replies
20. **Ticket resolved?**
    - **No**: Continue processing
    - **Yes**: Close ticket
21. **Customer rates ticket resolution** → Session ends

### 3.3 Business Rules

| Rule | Description |
|------|-------------|
| **BR-AS-001** | After-sales customers **can** create tickets |
| **BR-AS-002** | Tickets can be created from conversations or directly |
| **BR-AS-003** | Conversation history is attached to tickets created from chat |
| **BR-AS-004** | Customers receive email notifications for ticket updates |
| **BR-AS-005** | Tickets must have SLA (Service Level Agreement) targets |
| **BR-AS-006** | High-priority tickets are auto-escalated if not resolved in 24h |

---

## 4. Human Agent Handoff Flow

### 4.1 Flow Diagram

```mermaid
sequenceDiagram
    participant C as Customer
    participant S as System
    participant Q as Queue
    participant A as Staff Agent
    participant N as Notification Service

    C->>S: Click "Contact Human Agent"
    S->>S: Create conversation record
    S->>Q: Add to queue
    S->>C: Show "Connecting to agent..."
    
    alt Staff Available
        Q->>A: Notify available staff
        A->>Q: Accept conversation
        Q->>S: Assign conversation
        S->>C: "Agent connected"
        S->>A: Show customer info + history
    else No Staff Available
        Q->>C: Show queue position
        Q->>N: Notify all staff
        loop Wait for staff
            Q->>C: Update queue position
        end
        A->>Q: Accept conversation
        Q->>S: Assign conversation
        S->>C: "Agent connected"
        S->>A: Show customer info + history
    end
    
    loop Conversation
        C->>A: Send message
        A->>C: Send reply
    end
    
    alt Issue Resolved
        A->>S: Close conversation
        S->>C: Request rating
        C->>S: Submit rating
        S->>A: Show rating
    else Create Ticket
        A->>S: Create ticket from conversation
        S->>C: Notify ticket created
        S->>A: Show ticket details
    end
```

### 4.2 Queue Management

#### Queue Priority Rules
1. **VIP customers**: Priority 1 (highest)
2. **Long wait time**: Priority 2 (>3 minutes)
3. **Regular customers**: Priority 3 (FIFO)

#### Auto-Assignment Logic
```
IF staff.status == 'available' AND staff.current_conversations < max_concurrent THEN
    ASSIGN conversation TO staff
    SET staff.status = 'busy'
ELSE
    ADD conversation TO queue
    NOTIFY all available staff
END IF
```

---

## 5. Ticket Creation Flow

### 5.1 Flow Diagram

```mermaid
flowchart TD
    Start([Initiate Ticket Creation]) --> Source{Creation Source}
    
    Source -->|From Conversation| FromChat[Staff Creates from Chat]
    Source -->|Direct Creation| DirectCreate[Customer Creates Directly]
    
    FromChat --> AutoFill[Auto-fill from Conversation]
    AutoFill --> ReviewForm[Staff Reviews Form]
    ReviewForm --> FillDetails[Fill Additional Details]
    
    DirectCreate --> ShowForm[Show Ticket Form]
    ShowForm --> FillForm[Customer Fills Form]
    
    FillDetails --> ValidateForm[Validate Form]
    FillForm --> ValidateForm
    
    ValidateForm --> Valid{Form Valid?}
    Valid -->|No| ShowErrors[Show Validation Errors]
    ShowErrors --> FillForm
    
    Valid -->|Yes| CheckZammad{Zammad Enabled?}
    
    CheckZammad -->|Yes| CreateZammad[Create Ticket in Zammad]
    CheckZammad -->|No| CreateLocal[Create Ticket in Database]
    
    CreateZammad --> SyncSuccess{Sync Success?}
    SyncSuccess -->|Yes| CreateLocal
    SyncSuccess -->|No| RetrySync[Retry Sync]
    RetrySync --> SyncSuccess
    
    CreateLocal --> GenerateID[Generate Ticket ID]
    GenerateID --> SaveDB[Save to Database]
    SaveDB --> SendNotification[Send Email Notification]
    SendNotification --> AssignStaff[Auto-assign to Staff]
    AssignStaff --> End([Ticket Created])
    
    style FromChat fill:#e1f5ff
    style DirectCreate fill:#fff4e6
    style CreateZammad fill:#e8f5e9
    style End fill:#f3e5f5
```

### 5.2 Ticket Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Title | Text | Yes | 10-200 characters |
| Description | Textarea | Yes | 50-5000 characters |
| Category | Select | Yes | Predefined list |
| Priority | Select | Yes | Low / Medium / High / Urgent |
| Attachments | File | No | Max 5 files, 10MB each |
| Customer Email | Email | Yes | Valid email format |
| Customer Name | Text | Yes | 2-100 characters |

### 5.3 Auto-Assignment Rules

```
IF ticket.priority == 'Urgent' THEN
    ASSIGN TO senior_staff WITH least_active_tickets
ELSE IF ticket.category == 'Technical' THEN
    ASSIGN TO technical_team WITH least_active_tickets
ELSE
    ASSIGN TO general_team WITH least_active_tickets
END IF
```

---

## 6. FAQ Self-Service Flow

### 6.1 Flow Diagram

```mermaid
flowchart TD
    Start([Customer Enters Portal]) --> ShowFAQ[Display Top FAQs]
    ShowFAQ --> Action{Customer Action}
    
    Action -->|Browse| BrowseCategory[Select Category]
    Action -->|Search| EnterSearch[Enter Search Keywords]
    Action -->|Type| TypeInput[Type in Input Field]
    
    BrowseCategory --> ShowItems[Show FAQ Items in Category]
    ShowItems --> SelectItem[Select FAQ Item]
    
    EnterSearch --> SearchEngine[Search Engine]
    SearchEngine --> SearchResults[Display Search Results]
    SearchResults --> SelectItem
    
    TypeInput --> KeywordMatcher[Keyword Matcher]
    KeywordMatcher --> Suggestions[Show Suggestions]
    Suggestions --> SelectSuggestion{Select Suggestion?}
    SelectSuggestion -->|Yes| SelectItem
    SelectSuggestion -->|No| ContinueTyping[Continue Typing]
    ContinueTyping --> TypeInput
    
    SelectItem --> ViewFAQ[View FAQ Answer]
    ViewFAQ --> TrackView[Track View Count]
    TrackView --> ShowRelated[Show Related FAQs]
    ShowRelated --> Helpful{Was This Helpful?}
    
    Helpful -->|Yes| RatePositive[Rate Positive]
    Helpful -->|No| RateNegative[Rate Negative]
    Helpful -->|Still Need Help| EscalateOptions[Show Escalation Options]
    
    RatePositive --> UpdateMetrics[Update FAQ Metrics]
    RateNegative --> UpdateMetrics
    UpdateMetrics --> End([End])
    
    EscalateOptions --> Escalate{Choose Escalation}
    Escalate -->|Contact Human| HumanHandoff[Human Agent Handoff]
    Escalate -->|Create Ticket| TicketCreation[Ticket Creation]
    
    HumanHandoff --> End
    TicketCreation --> End
    
    style ShowFAQ fill:#e1f5ff
    style ViewFAQ fill:#e8f5e9
    style EscalateOptions fill:#fff4e6
```

### 6.2 Keyword Matching Algorithm

```
FUNCTION matchKeywords(userInput):
    keywords = extractKeywords(userInput)
    matches = []
    
    FOR EACH keyword IN keywords:
        faqItems = database.query("SELECT * FROM faq_keywords WHERE keyword LIKE ?", keyword)
        FOR EACH item IN faqItems:
            score = calculateRelevanceScore(keyword, item)
            matches.add({item, score})
        END FOR
    END FOR
    
    SORT matches BY score DESC
    RETURN top 5 matches
END FUNCTION
```

### 6.3 Search Ranking Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Exact keyword match | 40% | Keyword appears in question/answer |
| Partial match | 20% | Keyword partially matches |
| View count | 15% | Popular FAQs ranked higher |
| Positive ratings | 15% | Highly rated FAQs ranked higher |
| Recency | 10% | Recently updated FAQs ranked higher |

---

## 7. Staff Workflow

### 7.1 Daily Workflow Diagram

```mermaid
flowchart TD
    Start([Staff Logs In]) --> Dashboard[View Dashboard]
    Dashboard --> CheckQueue[Check Conversation Queue]
    CheckQueue --> QueueEmpty{Queue Empty?}
    
    QueueEmpty -->|No| AcceptConv[Accept Conversation]
    QueueEmpty -->|Yes| CheckTickets[Check Assigned Tickets]
    
    AcceptConv --> ViewCustomer[View Customer Info]
    ViewCustomer --> StartChat[Start Conversation]
    StartChat --> ChatActions{Chat Actions}
    
    ChatActions -->|Reply| SendReply[Send Reply]
    ChatActions -->|Quick Reply| UseTemplate[Use Quick Reply Template]
    ChatActions -->|Add Note| AddNote[Add Internal Note]
    ChatActions -->|Create Ticket| CreateTicket[Create Ticket from Chat]
    ChatActions -->|Transfer| TransferConv[Transfer to Another Staff]
    ChatActions -->|Close| CloseConv[Close Conversation]
    
    SendReply --> ChatActions
    UseTemplate --> ChatActions
    AddNote --> ChatActions
    CreateTicket --> UpdateTicket[Update Ticket Status]
    TransferConv --> CheckQueue
    CloseConv --> CheckQueue
    
    CheckTickets --> TicketsEmpty{Tickets Empty?}
    TicketsEmpty -->|No| SelectTicket[Select Ticket]
    TicketsEmpty -->|Yes| ManageFAQ[Manage FAQ Content]
    
    SelectTicket --> TicketActions{Ticket Actions}
    TicketActions -->|Investigate| InvestigateIssue[Investigate Issue]
    TicketActions -->|Reply| AddReply[Add Public Reply]
    TicketActions -->|Note| AddTicketNote[Add Internal Note]
    TicketActions -->|Update Status| UpdateTicket
    TicketActions -->|Close| CloseTicket[Close Ticket]
    
    InvestigateIssue --> TicketActions
    AddReply --> TicketActions
    AddTicketNote --> TicketActions
    UpdateTicket --> CheckTickets
    CloseTicket --> CheckTickets
    
    ManageFAQ --> FAQActions{FAQ Actions}
    FAQActions -->|Add| AddFAQ[Add New FAQ]
    FAQActions -->|Edit| EditFAQ[Edit Existing FAQ]
    FAQActions -->|Review| ReviewMetrics[Review FAQ Metrics]
    
    AddFAQ --> ManageFAQ
    EditFAQ --> ManageFAQ
    ReviewMetrics --> ViewAnalytics[View Analytics Dashboard]
    ViewAnalytics --> End([End of Day])
    
    style Dashboard fill:#e1f5ff
    style AcceptConv fill:#e8f5e9
    style CreateTicket fill:#fff4e6
    style CloseConv fill:#f3e5f5
    style CloseTicket fill:#f3e5f5
```

### 7.2 Staff Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Average Response Time | <30 seconds | Time from customer message to first staff reply |
| Average Resolution Time | <10 minutes | Time from conversation start to close |
| Conversations per Day | >20 | Total conversations handled |
| Customer Satisfaction | >4.5/5 | Average rating from customers |
| First Contact Resolution | >70% | % of issues resolved in first conversation |
| Ticket Resolution Time | <24 hours | Average time to resolve tickets |

---

## 8. Exception Handling

### 8.1 System Failures

| Scenario | Handling |
|----------|----------|
| WebSocket disconnection | Auto-reconnect with exponential backoff |
| Database timeout | Retry 3 times, then show error message |
| Zammad API failure | Create ticket locally, sync later |
| File upload failure | Show error, allow retry |
| Staff unavailable (>5 min wait) | Offer callback or ticket creation |

### 8.2 Business Exceptions

| Scenario | Handling |
|----------|----------|
| Customer closes browser during conversation | Save conversation state, allow resume |
| Staff goes offline during conversation | Auto-transfer to another available staff |
| Duplicate ticket creation | Detect and merge duplicates |
| Invalid file upload | Validate file type and size, show error |
| Spam detection | Rate limit, CAPTCHA, block IP |

---

**Document Status**: ✅ Complete  
**Next Review**: 2025-11-10  
**Approved By**: TBD

