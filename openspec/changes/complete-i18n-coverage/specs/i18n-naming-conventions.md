# Translation Key Naming Conventions

## Overview

本文档定义了客户服务平台翻译键的命名规范，确保翻译键的一致性、可维护性和可扩展性。

---

## Basic Format

翻译键采用分层命名结构，使用点号（`.`）分隔：

```
<namespace>.<feature>.<type>.<name>
```

### Examples

```typescript
admin.users.form.emailLabel          // Admin > Users > Form > Email Label
customer.tickets.actions.create      // Customer > Tickets > Actions > Create
toast.staff.conversations.sendError  // Toast > Staff > Conversations > Send Error
common.buttons.save                  // Common > Buttons > Save
```

---

## Namespace Hierarchy

### Level 1: Top-level Namespace

| Namespace | Purpose | Examples |
|-----------|---------|----------|
| `common` | 通用文本（跨多个功能使用） | buttons, labels, status |
| `nav` | 导航相关（菜单、面包屑） | dashboard, settings, logout |
| `auth` | 认证相关（登录、注册） | login, register, password |
| `errors` | 系统错误消息（HTTP 错误等） | unauthorized, serverError |
| `validation` | 表单验证消息 | required, emailInvalid |
| `toast` | Toast 通知消息（成功、错误等） | 按功能模块组织 |
| `admin` | 管理员门户功能 | users, faq, tickets, settings |
| `customer` | 客户门户功能 | dashboard, myTickets, feedback |
| `staff` | 员工门户功能 | conversations, tickets, customers |

### Level 2: Feature Module

功能模块对应系统的主要功能区域：

```
admin.users          // 用户管理
admin.faq            // FAQ 管理
admin.tickets        // 工单管理
admin.settings       // 管理员设置

customer.dashboard   // 客户仪表板
customer.myTickets   // 我的工单
customer.feedback    // 反馈建议
customer.complaints  // 投诉管理

staff.conversations  // 对话管理
staff.tickets        // 工单处理
staff.customers      // 客户管理
```

### Level 3: Content Type

内容类型定义了翻译文本的用途：

| Type | Purpose | Naming Pattern | Examples |
|------|---------|----------------|----------|
| `titles` | 页面/卡片/区域标题 | 名词/名词短语 | `pageTitle`, `sectionTitle` |
| `descriptions` | 描述性文本 | 完整句子 | `pageDescription`, `cardDescription` |
| `form` | 表单字段相关 | 字段名 + 后缀 | `emailLabel`, `emailPlaceholder` |
| `actions` | 操作按钮 | 动词/动词短语 | `create`, `update`, `delete`, `cancel` |
| `messages` | 提示消息 | 状态 + 后缀 | `createSuccess`, `deleteError` |
| `status` | 状态标签 | 形容词/名词 | `active`, `pending`, `completed` |
| `tabs` | 标签页名称 | 名词 | `overview`, `details`, `history` |
| `columns` | 表格列标题 | 名词 | `name`, `email`, `createdAt` |

### Level 4: Specific Name

具体名称采用 **camelCase**：

```
emailLabel          // ✅ Correct
email_label         // ❌ Wrong (snake_case)
EmailLabel          // ❌ Wrong (PascalCase)
```

---

## Naming Rules by Type

### 1. Form Fields

表单字段使用字段名 + 特定后缀：

| Suffix | Purpose | Example Value | Translation Key |
|--------|---------|---------------|-----------------|
| `Label` | 基础标签 | "Email" | `emailLabel` |
| `Required` | 带必填标记的标签 | "Email *" | `emailRequired` |
| `Placeholder` | 输入占位符 | "Enter your email" | `emailPlaceholder` |
| `Helper` | 帮助文本 | "We'll never share your email" | `emailHelper` |
| `Error` | 字段级错误消息 | "Invalid email format" | `emailError` |

**Complete Example:**

```json
{
  "admin": {
    "users": {
      "form": {
        "emailLabel": "Email",
        "emailRequired": "Email *",
        "emailPlaceholder": "user@example.com",
        "emailHelper": "This will be the user's login credential",
        "emailError": "Please enter a valid email address",

        "passwordLabel": "Password",
        "passwordRequired": "Password *",
        "passwordPlaceholder": "Minimum 8 characters",
        "passwordHelper": "Must contain uppercase, lowercase, and numbers",

        "fullNameLabel": "Full Name",
        "fullNameRequired": "Full Name *",
        "fullNamePlaceholder": "John Doe"
      }
    }
  }
}
```

### 2. Action Buttons

操作按钮使用动词或动词短语：

| Pattern | Examples | Translation Keys |
|---------|----------|------------------|
| 单个动词 | Create, Update, Delete, Cancel | `create`, `update`, `delete`, `cancel` |
| 动词 + 名词 | Create User, Add Comment | `createUser`, `addComment` |
| 动词短语 | Save Changes, Go Back | `saveChanges`, `goBack` |

**Grouping:**

```json
{
  "admin": {
    "users": {
      "actions": {
        "create": "Create User",
        "update": "Update User",
        "delete": "Delete",
        "cancel": "Cancel",
        "backToList": "Back to Users",
        "saveChanges": "Save Changes"
      }
    }
  }
}
```

### 3. Toast Messages

Toast 消息按模块分组，使用状态 + 后缀：

| Suffix | Purpose | Example |
|--------|---------|---------|
| `Success` | 成功消息 | `createSuccess`, `updateSuccess` |
| `Error` | 错误消息 | `createError`, `deleteError` |
| `Warning` | 警告消息 | `unsavedChangesWarning` |
| `Info` | 信息提示 | `processingInfo` |

**Structure:**

```json
{
  "toast": {
    "admin": {
      "users": {
        "createSuccess": "User created successfully!",
        "createError": "Failed to create user",
        "updateSuccess": "User updated successfully!",
        "updateError": "Failed to update user",
        "deleteSuccess": "User deleted",
        "deleteError": "Failed to delete user"
      }
    },
    "customer": {
      "complaints": {
        "submitSuccess": "Your complaint has been submitted",
        "submitError": "Failed to submit complaint"
      },
      "feedback": {
        "submitSuccess": "Thank you for your feedback!",
        "submitError": "Failed to submit feedback"
      }
    },
    "staff": {
      "conversations": {
        "sendSuccess": "Message sent",
        "sendError": "Failed to send message",
        "transferSuccess": "Conversation transferred",
        "transferError": "Failed to transfer conversation"
      }
    }
  }
}
```

### 4. Status Labels

状态标签使用形容词或名词：

```json
{
  "common": {
    "status": {
      "active": "Active",
      "inactive": "Inactive",
      "pending": "Pending",
      "completed": "Completed",
      "cancelled": "Cancelled",
      "open": "Open",
      "closed": "Closed",
      "resolved": "Resolved"
    }
  }
}
```

### 5. Validation Messages

验证消息使用描述性名称：

```json
{
  "validation": {
    "required": "This field is required",
    "emailInvalid": "Invalid email address",
    "minLength": "Must be at least {min} characters",
    "maxLength": "Must be at most {max} characters",
    "passwordMismatch": "Passwords do not match",
    "phoneInvalid": "Invalid phone number format",
    "urlInvalid": "Invalid URL format"
  }
}
```

---

## Special Cases

### 1. Variable Interpolation

包含动态内容的翻译使用 `{variableName}` 占位符：

```json
{
  "greeting": "Hello, {name}!",
  "itemCount": "You have {count} items",
  "dateRange": "From {start} to {end}",
  "userCreated": "User {email} created successfully",
  "characterCount": "{current}/{max} characters"
}
```

**Variable Naming:**
- 使用描述性名称：`{userName}` 而非 `{n}`
- 使用 camelCase：`{firstName}` 而非 `{first_name}`
- 与组件中的变量名保持一致

### 2. Pluralization

支持复数形式（next-intl 自动处理）：

```json
{
  "itemCount_zero": "No items",
  "itemCount_one": "You have {count} item",
  "itemCount_other": "You have {count} items"
}
```

### 3. Rich Text / Formatting

包含格式化标记的翻译：

```json
{
  "termsText": "I agree to the <link>Terms and Conditions</link>",
  "warningText": "This action is <strong>permanent</strong> and cannot be undone"
}
```

### 4. Locale-specific Content

某些内容可能需要针对特定语言：

```json
// en.json
{
  "dateFormat": "MM/DD/YYYY",
  "timeFormat": "12h"
}

// zh-CN.json
{
  "dateFormat": "YYYY年MM月DD日",
  "timeFormat": "24h"
}
```

---

## Anti-patterns

### ❌ Don't: Over-nesting

```json
// ❌ Too deep
{
  "admin": {
    "pages": {
      "users": {
        "create": {
          "form": {
            "fields": {
              "email": {
                "label": "Email"
              }
            }
          }
        }
      }
    }
  }
}

// ✅ Better
{
  "admin": {
    "users": {
      "form": {
        "emailLabel": "Email"
      }
    }
  }
}
```

### ❌ Don't: Abbreviations

```json
// ❌ Unclear
{
  "usr": {
    "crt": "Create",
    "del": "Delete"
  }
}

// ✅ Clear
{
  "users": {
    "create": "Create",
    "delete": "Delete"
  }
}
```

### ❌ Don't: Mixing Naming Styles

```json
// ❌ Inconsistent
{
  "createUser": "Create User",
  "update_user": "Update User",
  "DeleteUser": "Delete User"
}

// ✅ Consistent (camelCase)
{
  "createUser": "Create User",
  "updateUser": "Update User",
  "deleteUser": "Delete User"
}
```

### ❌ Don't: Overly Generic Keys

```json
// ❌ Unclear context
{
  "title": "Title",
  "description": "Description",
  "button": "Button"
}

// ✅ Specific context
{
  "pageTitle": "User Management",
  "cardDescription": "Manage system users",
  "submitButton": "Create User"
}
```

---

## Namespace Organization Best Practices

### 1. Common Namespace

仅用于真正通用的文本（至少在 3 个以上不同功能中使用）：

```json
{
  "common": {
    "buttons": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "submit": "Submit",
      "back": "Back",
      "next": "Next",
      "previous": "Previous",
      "close": "Close",
      "confirm": "Confirm"
    },
    "status": {
      "active": "Active",
      "inactive": "Inactive",
      "pending": "Pending",
      "completed": "Completed"
    },
    "time": {
      "today": "Today",
      "yesterday": "Yesterday",
      "lastWeek": "Last Week",
      "justNow": "Just now"
    }
  }
}
```

### 2. Feature-specific Namespace

功能特定的文本使用独立 namespace，避免污染 common：

```json
{
  "admin": {
    "users": {
      "pageTitle": "User Management",
      "searchPlaceholder": "Search users...",
      "noUsersFound": "No users found",
      "form": {
        // Form-specific keys
      },
      "actions": {
        // Action-specific keys
      }
    }
  }
}
```

### 3. Toast Namespace

Toast 消息独立组织，按功能模块分组：

```json
{
  "toast": {
    "admin": {
      "users": {
        "createSuccess": "User created successfully!",
        "createError": "Failed to create user",
        "updateSuccess": "User updated successfully!",
        "deleteSuccess": "User deleted"
      },
      "faq": {
        "articleCreated": "Article created successfully!",
        "articleDeleted": "Article deleted"
      }
    },
    "customer": {
      "tickets": {
        "createSuccess": "Ticket created successfully!",
        "createError": "Failed to create ticket"
      }
    }
  }
}
```

---

## Complete Examples

### Example 1: Admin User Management

```json
{
  "admin": {
    "users": {
      "pageTitle": "User Management",
      "pageDescription": "Manage system users, roles, and permissions",
      "createTitle": "Create New User",
      "createDescription": "Add a new user to the system with role and region assignment",
      "editTitle": "Edit User",
      "searchPlaceholder": "Search users by name or email...",
      "noUsersFound": "No users found",
      "confirmDelete": "Are you sure you want to delete this user?",

      "form": {
        "emailLabel": "Email",
        "emailRequired": "Email *",
        "emailPlaceholder": "user@example.com",
        "emailHelper": "This will be the user's login credential",

        "passwordLabel": "Password",
        "passwordRequired": "Password *",
        "passwordPlaceholder": "Minimum 8 characters",
        "passwordHelper": "Must contain uppercase, lowercase, and numbers",

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
      }
    }
  },

  "toast": {
    "admin": {
      "users": {
        "createSuccess": "User {name} created successfully!",
        "createError": "Failed to create user",
        "updateSuccess": "User updated successfully!",
        "updateError": "Failed to update user",
        "deleteSuccess": "User deleted",
        "deleteError": "Failed to delete user",
        "validationError": "Validation error: {message}"
      }
    }
  }
}
```

### Example 2: Customer Feedback

```json
{
  "customer": {
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
        "contentPlaceholder": "Please describe your feedback in detail...",

        "attachmentLabel": "Attachments",
        "attachmentHelper": "Optional: Upload screenshots or files (max 5MB)"
      },

      "categories": {
        "feature": "Feature Request",
        "improvement": "Improvement Suggestion",
        "ui": "UI/UX Improvement",
        "other": "Other Suggestion"
      },

      "actions": {
        "submit": "Submit Feedback",
        "cancel": "Cancel",
        "reset": "Reset Form"
      }
    }
  },

  "toast": {
    "customer": {
      "feedback": {
        "submitSuccess": "Thank you for your feedback! We will review it.",
        "submitError": "Failed to submit feedback. Please try again."
      }
    }
  }
}
```

---

## Migration Guide

### Step 1: Identify Hardcoded Strings

使用检测脚本找出所有硬编码字符串：

```bash
npm run i18n:detect-hardcoded
```

### Step 2: Design Translation Keys

根据命名规范设计翻译键：

```typescript
// Hardcoded (Before)
<Label htmlFor="email">Email Address *</Label>

// Translation key design
admin.users.form.emailRequired

// Value in en.json
"Email Address *"
```

### Step 3: Add to Translation Files

将翻译键添加到所有语言文件（先 en.json，再其他）。

### Step 4: Update Component

更新组件使用翻译：

```tsx
// Before ❌
<Label htmlFor="email">Email Address *</Label>

// After ✅
const t = useTranslations('admin.users.form')
<Label htmlFor="email">{t('emailRequired')}</Label>
```

---

## Code Review Checklist

在 Code Review 时检查：

- [ ] **一致的命名风格**：所有键使用 camelCase
- [ ] **适当的 namespace**：不滥用 common，功能键放在对应模块
- [ ] **完整的后缀**：表单字段包含所有必要后缀（Label, Required, Placeholder）
- [ ] **清晰的层级**：不超过 4-5 层嵌套
- [ ] **描述性名称**：避免缩写，使用完整单词
- [ ] **变量命名**：插值变量使用描述性名称
- [ ] **所有语言同步**：新增键在所有语言文件中都存在

---

## Quick Reference

### Common Patterns

```typescript
// Page titles
t('admin.users.pageTitle')
t('customer.dashboard.pageTitle')

// Form labels
t('admin.users.form.emailRequired')
t('customer.tickets.form.titlePlaceholder')

// Actions
t('admin.users.actions.createUser')
t('common.buttons.save')

// Toast messages
const tToast = useTranslations('toast.admin.users')
toast.success(tToast('createSuccess'))
toast.error(tToast('createError'))

// Validation
const tValidation = useTranslations('validation')
setError('email', { message: tValidation('emailInvalid') })

// Status
const tStatus = useTranslations('common.status')
<Badge>{tStatus('active')}</Badge>

// With variables
t('toast.admin.users.createSuccess', { name: user.full_name })
t('validation.minLength', { min: 8 })
```

---

## Tooling Support

### VS Code Snippets

建议添加代码片段加速开发：

```json
{
  "Import useTranslations": {
    "prefix": "uit",
    "body": [
      "import { useTranslations } from 'next-intl'",
      "",
      "const t = useTranslations('${1:namespace}')"
    ]
  },

  "Translation Key": {
    "prefix": "tkey",
    "body": [
      "t('${1:key}')"
    ]
  }
}
```

### TypeScript Type Safety

考虑使用 next-intl 的类型生成功能（未来增强）：

```typescript
// 自动生成的类型
type TranslationKeys =
  | 'admin.users.pageTitle'
  | 'admin.users.form.emailLabel'
  | 'toast.admin.users.createSuccess'
  // ... 所有翻译键

// 使用时有自动完成和类型检查
const t = useTranslations('admin.users')
t('pageTitle')  // ✅ 类型检查通过
t('invalidKey') // ❌ 类型错误
```

---

## Related Documents

- [i18n Requirements Specification](./i18n-requirements.md)
- [Translation Schema Definition](./translation-schema.md)
- [CLAUDE.md - Internationalization](../../../CLAUDE.md#internationalization)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)

---

## Change History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-11-25 | 1.0 | Claude Code | 初始版本：定义翻译键命名规范 |
