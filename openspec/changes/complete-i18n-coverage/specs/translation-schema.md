# Translation File Target Structure

## Overview

本文档定义了客户服务平台翻译文件的完整目标结构，确保所有语言文件（en.json, zh-CN.json, fr.json, es.json, ru.json, pt.json）具有一致的键结构。

---

## Complete Structure

以下是完整的翻译键结构，所有语言文件必须包含这些键：

```json
{
  "common": {
    "appName": "...",
    "loading": "...",
    "loadingWithDots": "...",
    "error": "...",
    "success": "...",
    "warning": "...",
    "info": "...",
    "cancel": "...",
    "save": "...",
    "delete": "...",
    "edit": "...",
    "create": "...",
    "update": "...",
    "search": "...",
    "filter": "...",
    "clear": "...",
    "submit": "...",
    "back": "...",
    "next": "...",
    "previous": "...",
    "close": "...",
    "confirm": "...",
    "yes": "...",
    "no": "...",
    "saveChanges": "...",
    "saving": "...",
    "actions": "...",

    "localeNames": {
      "en": "English",
      "zh-CN": "简体中文",
      "fr": "Français",
      "es": "Español",
      "ru": "Русский",
      "pt": "Português"
    },

    "status": {
      "active": "...",
      "inactive": "...",
      "pending": "...",
      "completed": "...",
      "cancelled": "...",
      "open": "...",
      "closed": "...",
      "resolved": "...",
      "inProgress": "..."
    },

    "time": {
      "justNow": "...",
      "minutesAgo": "{minutes} minutes ago",
      "hoursAgo": "{hours} hours ago",
      "daysAgo": "{days} days ago",
      "today": "...",
      "yesterday": "...",
      "lastWeek": "..."
    }
  },

  "nav": {
    "dashboard": "...",
    "conversations": "...",
    "faq": "...",
    "tickets": "...",
    "myTickets": "...",
    "knowledgeBase": "...",
    "users": "...",
    "customers": "...",
    "settings": "...",
    "logout": "...",
    "profile": "...",
    "feedback": "...",
    "complaints": "..."
  },

  "auth": {
    "login": "...",
    "register": "...",
    "logout": "...",
    "email": "...",
    "password": "...",
    "confirmPassword": "...",
    "fullName": "...",
    "forgotPassword": "...",
    "resetPassword": "...",
    "noAccount": "...",
    "hasAccount": "...",
    "loginButton": "...",
    "registerButton": "...",
    "loggingIn": "...",
    "registering": "...",
    "loginSuccess": "...",
    "registerSuccess": "...",
    "loginError": "...",
    "registerError": "...",
    "logoutSuccess": "...",
    "sessionExpired": "...",
    "emailRequired": "...",
    "emailInvalid": "...",
    "passwordRequired": "...",
    "passwordMinLength": "...",
    "passwordMismatch": "...",
    "fullNameRequired": "..."
  },

  "errors": {
    "unauthorized": "...",
    "forbidden": "...",
    "notFound": "...",
    "serverError": "...",
    "networkError": "...",
    "validationError": "...",
    "timeout": "...",
    "unexpectedError": "..."
  },

  "validation": {
    "required": "...",
    "emailInvalid": "...",
    "phoneInvalid": "...",
    "urlInvalid": "...",
    "minLength": "Must be at least {min} characters",
    "maxLength": "Must be at most {max} characters",
    "min": "Must be at least {min}",
    "max": "Must be at most {max}",
    "passwordMismatch": "..."
  },

  "toast": {
    "admin": {
      "users": {
        "createSuccess": "User created successfully!",
        "createError": "Failed to create user",
        "updateSuccess": "User updated successfully!",
        "updateError": "Failed to update user",
        "deleteSuccess": "User deleted",
        "deleteError": "Failed to delete user",
        "validationError": "Validation error"
      },
      "faq": {
        "createSuccess": "Article created successfully!",
        "createError": "Failed to create article",
        "updateSuccess": "Article updated successfully!",
        "updateError": "Failed to update article",
        "deleteSuccess": "Article deleted",
        "deleteError": "Failed to delete article",
        "translationRequired": "Please provide at least one language translation"
      },
      "settings": {
        "saveSuccess": "Settings saved successfully!",
        "saveError": "Failed to save settings"
      }
    },
    "customer": {
      "tickets": {
        "createSuccess": "Ticket created successfully!",
        "createError": "Failed to create ticket",
        "updateSuccess": "Ticket updated",
        "updateError": "Failed to update ticket"
      },
      "complaints": {
        "submitSuccess": "Your complaint has been submitted",
        "submitError": "Failed to submit complaint"
      },
      "feedback": {
        "submitSuccess": "Thank you for your feedback! We will review it.",
        "submitError": "Failed to submit feedback"
      },
      "settings": {
        "saveSuccess": "Settings saved successfully!",
        "saveError": "Failed to save settings"
      }
    },
    "staff": {
      "conversations": {
        "sendSuccess": "Message sent",
        "sendError": "Failed to send message",
        "transferSuccess": "Conversation transferred successfully",
        "transferError": "Failed to transfer conversation",
        "aiUnavailable": "AI service is temporarily unavailable, please transfer to human agent",
        "networkError": "Network connection failed, please check and retry",
        "aiFailed": "AI response failed, please retry or transfer to human agent"
      },
      "tickets": {
        "updateSuccess": "Ticket updated",
        "updateError": "Failed to update ticket",
        "closeSuccess": "Ticket closed",
        "closeError": "Failed to close ticket"
      },
      "settings": {
        "saveSuccess": "Settings saved successfully!",
        "saveError": "Failed to save settings"
      }
    }
  },

  "admin": {
    "users": {
      "pageTitle": "User Management",
      "pageDescription": "Manage system users, roles, and permissions",
      "createTitle": "Create New User",
      "createDescription": "Add a new user to the system with role and region assignment",
      "editTitle": "Edit User",
      "searchPlaceholder": "Search users...",
      "noUsersFound": "No users found",
      "confirmDelete": "Are you sure you want to delete this user?",

      "form": {
        "emailLabel": "Email",
        "emailRequired": "Email Address *",
        "emailPlaceholder": "user@example.com",

        "passwordLabel": "Password",
        "passwordRequired": "Password *",
        "passwordPlaceholder": "Minimum 8 characters",
        "passwordHelper": "Password must be at least 8 characters long",

        "fullNameLabel": "Full Name",
        "fullNameRequired": "Full Name *",
        "fullNamePlaceholder": "John Doe",

        "roleLabel": "Role",
        "roleRequired": "Role *",
        "roleSelectPrompt": "Select a role",

        "regionLabel": "Region",
        "regionRequired": "Region *",
        "regionSelectPrompt": "Select a region",

        "phoneLabel": "Phone",
        "phonePlaceholder": "+1 (555) 000-0000",

        "languageLabel": "Language",
        "languageSelectPrompt": "Select a language"
      },

      "actions": {
        "createUser": "Create User",
        "updateUser": "Update User",
        "deleteUser": "Delete",
        "editUser": "Edit",
        "backToList": "Back to Users",
        "saveChanges": "Save Changes",
        "cancel": "Cancel"
      },

      "columns": {
        "name": "Name",
        "email": "Email",
        "role": "Role",
        "region": "Region",
        "status": "Status",
        "createdAt": "Created At",
        "actions": "Actions"
      },

      "roles": {
        "customer": "Customer",
        "staff": "Staff",
        "admin": "Admin",
        "customerDescription": "Can create tickets and view their own tickets",
        "staffDescription": "Can handle tickets in their assigned region",
        "adminDescription": "Full access to all features and regions"
      },

      "regions": {
        "northAmerica": "North America",
        "southAmerica": "South America",
        "europe": "Europe",
        "asiaPacific": "Asia-Pacific",
        "middleEast": "Middle East",
        "africa": "Africa"
      }
    },

    "faq": {
      "pageTitle": "FAQ Management",
      "createTitle": "Create New Article",
      "editTitle": "Edit Article",
      "deleteConfirm": "Are you sure you want to delete this article?",

      "form": {
        "titleLabel": "Title",
        "titleRequired": "Title *",
        "titlePlaceholder": "Enter article title",

        "contentLabel": "Content",
        "contentRequired": "Content *",
        "contentPlaceholder": "Enter article content...",

        "categoryLabel": "Category",
        "categorySelectPrompt": "Select a category",

        "keywordsLabel": "Keywords (comma-separated)",
        "keywordsPlaceholder": "keyword1, keyword2, keyword3",

        "languageLabel": "Language",
        "addTranslation": "Add Translation"
      },

      "actions": {
        "createArticle": "Create Article",
        "updateArticle": "Update Article",
        "saveChanges": "Save Changes",
        "cancel": "Cancel",
        "delete": "Delete"
      },

      "columns": {
        "title": "Title",
        "category": "Category",
        "translations": "Translations",
        "status": "Status",
        "createdAt": "Created At",
        "actions": "Actions"
      }
    },

    "dashboard": {
      "pageTitle": "Admin Dashboard",
      "welcome": "Welcome back, {name}",

      "stats": {
        "totalUsers": "Total Users",
        "totalTickets": "Total Tickets",
        "activeConversations": "Active Conversations",
        "avgResponseTime": "Avg Response Time"
      }
    }
  },

  "customer": {
    "dashboard": {
      "pageTitle": "Dashboard",
      "welcome": "Welcome, {name}",

      "stats": {
        "myTickets": "My Tickets",
        "openTickets": "Open Tickets",
        "resolvedTickets": "Resolved Tickets",
        "activeConversations": "Active Conversations"
      },

      "quickActions": {
        "title": "Quick Actions",
        "createTicket": "Create Ticket",
        "viewFAQ": "Browse FAQ",
        "contactSupport": "Contact Support"
      }
    },

    "myTickets": {
      "pageTitle": "My Tickets",
      "createTitle": "Create New Ticket",
      "searchPlaceholder": "Search tickets...",
      "noTicketsFound": "No tickets found",

      "form": {
        "titleLabel": "Title",
        "titleRequired": "Title *",
        "titlePlaceholder": "Brief description of the issue",

        "descriptionLabel": "Description",
        "descriptionRequired": "Description *",
        "descriptionPlaceholder": "Please describe your issue in detail...",

        "priorityLabel": "Priority",
        "prioritySelectPrompt": "Select priority",

        "categoryLabel": "Category",
        "categorySelectPrompt": "Select category"
      },

      "actions": {
        "createTicket": "Create Ticket",
        "updateTicket": "Update Ticket",
        "cancel": "Cancel",
        "backToList": "Back to Tickets"
      },

      "columns": {
        "number": "Number",
        "title": "Title",
        "status": "Status",
        "priority": "Priority",
        "createdAt": "Created",
        "updatedAt": "Updated"
      },

      "priority": {
        "low": "Low",
        "normal": "Normal",
        "high": "High",
        "urgent": "Urgent"
      }
    },

    "feedback": {
      "pageTitle": "Feedback & Suggestions",
      "pageDescription": "Share your ideas to help us improve",

      "form": {
        "categoryLabel": "Category",
        "categoryRequired": "Category *",
        "categorySelectPrompt": "Select a category",

        "titleLabel": "Title",
        "titleRequired": "Title *",
        "titlePlaceholder": "Brief description of your suggestion",

        "contentLabel": "Details",
        "contentRequired": "Details *",
        "contentPlaceholder": "Please describe your feedback in detail..."
      },

      "categories": {
        "feature": "Feature Request",
        "improvement": "Improvement Suggestion",
        "ui": "UI/UX Improvement",
        "other": "Other Suggestion"
      },

      "actions": {
        "submit": "Submit Feedback",
        "cancel": "Cancel"
      }
    },

    "complaints": {
      "pageTitle": "Submit Complaint",
      "pageDescription": "Report issues or concerns",

      "form": {
        "categoryLabel": "Category",
        "categoryRequired": "Category *",
        "categorySelectPrompt": "Select a category",

        "titleLabel": "Title",
        "titleRequired": "Title *",
        "titlePlaceholder": "Brief description of the issue",

        "contentLabel": "Details",
        "contentRequired": "Details *",
        "contentPlaceholder": "Please describe the issue in detail..."
      },

      "categories": {
        "service": "Service Quality",
        "product": "Product Issue",
        "billing": "Billing Problem",
        "technical": "Technical Issue",
        "other": "Other"
      },

      "actions": {
        "submit": "Submit Complaint",
        "cancel": "Cancel"
      }
    },

    "settings": {
      "pageTitle": "Settings",

      "profile": {
        "title": "Personal Information",
        "description": "Update your profile information",

        "fullNameLabel": "Full Name",
        "fullNamePlaceholder": "Enter your full name",

        "emailLabel": "Email",
        "emailHelper": "Email cannot be changed",

        "phoneLabel": "Phone",
        "phonePlaceholder": "Enter your phone number",

        "languageLabel": "Language"
      },

      "notifications": {
        "title": "Notification Settings",
        "description": "Manage your notification preferences",

        "emailNotifications": "Email Notifications",
        "emailNotificationsHelper": "Receive notifications via email",

        "desktopNotifications": "Desktop Notifications",
        "desktopNotificationsHelper": "Show desktop notifications",

        "ticketUpdates": "Ticket Updates",
        "ticketUpdatesHelper": "Notify when tickets are updated",

        "conversationReplies": "Conversation Replies",
        "conversationRepliesHelper": "Notify when you receive replies",

        "promotions": "Promotions",
        "promotionsHelper": "Receive promotional emails"
      },

      "actions": {
        "save": "Save Changes",
        "cancel": "Cancel"
      }
    },

    "conversations": {
      "pageTitle": "My Conversations",
      "startNew": "Start New Conversation",
      "noConversations": "No conversations yet",

      "messageInput": {
        "placeholder": "Type your message...",
        "send": "Send",
        "sending": "Sending..."
      },

      "transfer": {
        "requestHuman": "Request Human Agent",
        "transferReason": "Reason for transfer"
      }
    }
  },

  "staff": {
    "dashboard": {
      "pageTitle": "Staff Dashboard",
      "welcome": "Welcome, {name}",

      "stats": {
        "assignedTickets": "Assigned Tickets",
        "activeConversations": "Active Conversations",
        "resolvedToday": "Resolved Today",
        "avgResponseTime": "Avg Response Time"
      }
    },

    "conversations": {
      "pageTitle": "Conversations",
      "searchPlaceholder": "Search conversations...",
      "noConversations": "No conversations found",
      "newTransferNotification": "New transferred conversation",
      "transferReason": "Reason: {reason}",

      "messageInput": {
        "placeholder": "Type your reply...",
        "send": "Send",
        "sending": "Sending..."
      },

      "actions": {
        "close": "Close Conversation",
        "transfer": "Transfer",
        "escalate": "Escalate"
      },

      "columns": {
        "customer": "Customer",
        "subject": "Subject",
        "status": "Status",
        "assignee": "Assignee",
        "createdAt": "Created",
        "actions": "Actions"
      }
    },

    "tickets": {
      "pageTitle": "Tickets",
      "myTickets": "My Tickets",
      "allTickets": "All Tickets",
      "searchPlaceholder": "Search tickets...",

      "actions": {
        "assign": "Assign to Me",
        "close": "Close",
        "reopen": "Reopen",
        "escalate": "Escalate"
      },

      "columns": {
        "number": "Number",
        "title": "Title",
        "customer": "Customer",
        "status": "Status",
        "priority": "Priority",
        "assignee": "Assignee",
        "createdAt": "Created",
        "actions": "Actions"
      }
    },

    "customers": {
      "pageTitle": "Customers",
      "searchPlaceholder": "Search customers...",
      "noCustomers": "No customers found",

      "columns": {
        "name": "Name",
        "email": "Email",
        "phone": "Phone",
        "region": "Region",
        "tickets": "Tickets",
        "status": "Status",
        "actions": "Actions"
      }
    },

    "settings": {
      "pageTitle": "Settings",

      "profile": {
        "title": "Profile Information",

        "fullNameLabel": "Full Name",
        "fullNamePlaceholder": "Enter your full name",

        "emailLabel": "Email",
        "emailHelper": "Email cannot be changed",

        "phoneLabel": "Phone",
        "phonePlaceholder": "Enter your phone number",

        "languageLabel": "Language"
      },

      "notifications": {
        "title": "Notification Preferences",

        "emailNotifications": "Email Notifications",
        "desktopNotifications": "Desktop Notifications",
        "newTicket": "New Ticket Assignment",
        "newMessage": "New Message in Conversation"
      },

      "preferences": {
        "title": "Work Preferences",

        "autoAssign": "Auto-assign Tickets",
        "autoAssignHelper": "Automatically receive new tickets",

        "showClosedTickets": "Show Closed Tickets",
        "showClosedTicketsHelper": "Display closed tickets in the list",

        "defaultView": "Default View",
        "listView": "List",
        "gridView": "Grid"
      },

      "actions": {
        "save": "Save Settings",
        "cancel": "Cancel"
      }
    }
  },

  "dashboard": {
    "customer": {
      "title": "Dashboard",
      "welcome": "Welcome, {name}",
      "recentActivity": "Recent Activity",
      "quickActions": "Quick Actions"
    },
    "staff": {
      "title": "Staff Dashboard",
      "performance": "Your Performance",
      "recentTickets": "Recent Tickets"
    },
    "admin": {
      "title": "Admin Dashboard",
      "systemOverview": "System Overview",
      "userStats": "User Statistics"
    }
  },

  "conversations": {
    "title": "Conversations",
    "newConversation": "New Conversation",
    "typing": "{name} is typing...",
    "online": "Online",
    "offline": "Offline",
    "lastSeen": "Last seen {time}",

    "messageInput": {
      "placeholder": "Type a message...",
      "send": "Send",
      "attachFile": "Attach File"
    },

    "transfer": {
      "title": "Transfer Conversation",
      "description": "Transfer this conversation to a human agent",
      "reasonLabel": "Reason",
      "reasonPlaceholder": "Please explain why you need to transfer...",
      "submit": "Transfer",
      "cancel": "Cancel"
    }
  },

  "tickets": {
    "title": "Tickets",
    "myTickets": "My Tickets",
    "allTickets": "All Tickets",
    "newTicket": "New Ticket",
    "ticketDetails": "Ticket Details",
    "searchPlaceholder": "Search tickets...",
    "noTickets": "No tickets found",

    "status": {
      "new": "New",
      "open": "Open",
      "pending": "Pending",
      "resolved": "Resolved",
      "closed": "Closed"
    },

    "priority": {
      "low": "Low",
      "normal": "Normal",
      "high": "High",
      "urgent": "Urgent"
    }
  },

  "faq": {
    "title": "Frequently Asked Questions",
    "searchPlaceholder": "Search FAQ...",
    "allCategories": "All Categories",
    "noResults": "No results found",
    "helpful": "Was this helpful?",
    "yes": "Yes",
    "no": "No",
    "thankYou": "Thank you for your feedback!"
  }
}
```

---

## Priority Levels

翻译键按优先级分为 3 个级别：

### P0 (Critical - Must Have)

这些键必须在所有语言中完整实现：

- `common.*` - 通用文本
- `nav.*` - 导航
- `auth.*` - 认证
- `errors.*` - 错误消息
- `validation.*` - 表单验证
- `toast.*` - 所有 Toast 消息

### P1 (High - Should Have)

这些键应该在 P0 语言（en, zh-CN）中完整实现：

- `admin.users.*` - 用户管理
- `admin.faq.*` - FAQ 管理
- `customer.dashboard.*` - 客户仪表板
- `customer.myTickets.*` - 我的工单
- `customer.settings.*` - 客户设置
- `staff.conversations.*` - 员工对话
- `staff.tickets.*` - 员工工单

### P2 (Medium - Nice to Have)

这些键可以逐步补充：

- `customer.feedback.*` - 反馈建议
- `customer.complaints.*` - 投诉管理
- `staff.customers.*` - 客户管理
- `staff.settings.*` - 员工设置

---

## Validation Checklist

创建或更新翻译文件时，确保：

- [ ] 所有 P0 键在所有 6 种语言中都存在
- [ ] 键名使用 camelCase
- [ ] 插值变量使用描述性名称（`{name}` 而非 `{n}`）
- [ ] 相同功能的键在不同 namespace 中保持一致
- [ ] 没有硬编码的语言特定内容（日期格式除外）
- [ ] Toast 消息都在 `toast.*` namespace 下
- [ ] 表单字段使用标准后缀（Label, Required, Placeholder, Helper）
- [ ] 操作按钮都在 `actions` 子键下

---

## Migration Checklist

从硬编码字符串迁移到翻译键时：

1. **识别字符串用途**
   - 是页面标题？→ `pageTitle`
   - 是表单标签？→ `form.fieldLabel` 或 `form.fieldRequired`
   - 是按钮？→ `actions.actionName`
   - 是 Toast？→ `toast.module.feature.statusSuffix`

2. **确定 Namespace**
   - 是否多处使用？→ 考虑 `common`
   - 是否功能特定？→ 使用 `admin`/`customer`/`staff`
   - 是否 Toast 消息？→ 使用 `toast`

3. **设计翻译键**
   - 遵循命名约定
   - 使用描述性名称
   - 检查是否已存在类似的键

4. **添加到所有语言文件**
   - 先添加到 en.json
   - 再添加到 zh-CN.json
   - 最后添加到其他语言文件

---

## Real-world Examples

### Example 1: Admin User Creation Page

**Hardcoded (Before):**
```tsx
<Label htmlFor="email">Email Address *</Label>
<Input
  id="email"
  placeholder="user@example.com"
/>
<Button>Create User</Button>
<Button variant="outline">Back to Users</Button>
```

**Translation Keys (After):**
```tsx
const t = useTranslations('admin.users')

<Label htmlFor="email">{t('form.emailRequired')}</Label>
<Input
  id="email"
  placeholder={t('form.emailPlaceholder')}
/>
<Button>{t('actions.createUser')}</Button>
<Button variant="outline">{t('actions.backToList')}</Button>
```

**Translation File:**
```json
{
  "admin": {
    "users": {
      "form": {
        "emailRequired": "Email Address *",
        "emailPlaceholder": "user@example.com"
      },
      "actions": {
        "createUser": "Create User",
        "backToList": "Back to Users"
      }
    }
  }
}
```

### Example 2: Toast Messages

**Hardcoded (Before):**
```tsx
toast.success('User created successfully!')
toast.error('保存失败')
toast.error('AI服务暂时不可用，请转人工客服获取帮助')
```

**Translation Keys (After):**
```tsx
const tToast = useTranslations('toast.admin.users')
toast.success(tToast('createSuccess'))

const tToast2 = useTranslations('toast.customer.settings')
toast.error(tToast2('saveError'))

const tToast3 = useTranslations('toast.staff.conversations')
toast.error(tToast3('aiUnavailable'))
```

**Translation File:**
```json
{
  "toast": {
    "admin": {
      "users": {
        "createSuccess": "User created successfully!"
      }
    },
    "customer": {
      "settings": {
        "saveError": "Failed to save"
      }
    },
    "staff": {
      "conversations": {
        "aiUnavailable": "AI service is temporarily unavailable, please transfer to human agent"
      }
    }
  }
}
```

### Example 3: Language Selector

**Hardcoded (Before):**
```tsx
<Select>
  <SelectItem value="en">English</SelectItem>
  <SelectItem value="zh-CN">简体中文</SelectItem>
  <SelectItem value="fr">Français</SelectItem>
</Select>
```

**Translation Keys (After):**
```tsx
import { locales } from '@/i18n'

const t = useTranslations('common.localeNames')

<Select>
  {locales.map((locale) => (
    <SelectItem key={locale} value={locale}>
      {t(locale)}
    </SelectItem>
  ))}
</Select>
```

**Translation File (All Locales):**
```json
{
  "common": {
    "localeNames": {
      "en": "English",
      "zh-CN": "简体中文",
      "fr": "Français",
      "es": "Español",
      "ru": "Русский",
      "pt": "Português"
    }
  }
}
```

---

## JSON Schema (Optional)

为了确保结构一致性，可以使用 JSON Schema 验证：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["common", "nav", "auth", "errors", "validation", "toast"],
  "properties": {
    "common": {
      "type": "object",
      "required": ["appName", "loading", "localeNames", "status"]
    },
    "nav": {
      "type": "object",
      "required": ["dashboard", "conversations", "tickets", "settings"]
    },
    "auth": {
      "type": "object",
      "required": ["login", "email", "password", "loginButton"]
    },
    "toast": {
      "type": "object",
      "properties": {
        "admin": { "type": "object" },
        "customer": { "type": "object" },
        "staff": { "type": "object" }
      }
    }
  }
}
```

---

## Related Documents

- [i18n Requirements Specification](./i18n-requirements.md)
- [i18n Naming Conventions](./i18n-naming-conventions.md)
- [Implementation Tasks](../tasks.md)

---

## Change History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-11-25 | 1.0 | Claude Code | 初始版本：定义完整翻译文件目标结构 |
