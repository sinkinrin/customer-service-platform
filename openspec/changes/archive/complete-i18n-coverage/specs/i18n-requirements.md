# Internationalization (i18n) Requirements Specification

## Overview

本规范定义了客户服务平台的国际化（i18n）实施要求，确保所有用户界面文本都能正确翻译为支持的语言。

## Supported Locales

系统必须支持以下语言区域：

| Locale Code | Language Name | Priority | Status |
|-------------|---------------|----------|---------|
| `en` | English | P0 (Primary) | ✅ 完成 |
| `zh-CN` | 简体中文 | P0 (Primary) | ✅ 完成 |
| `fr` | Français | P1 (Secondary) | ⚠️ 部分完成 |
| `es` | Español | P1 (Secondary) | ⚠️ 部分完成 |
| `ru` | Русский | P1 (Secondary) | ⚠️ 部分完成 |
| `pt` | Português | P1 (Secondary) | ⚠️ 部分完成 |

## Core Requirements

### REQ-I18N-001: All UI Strings Must Be Translatable

**Priority**: P0
**Status**: ❌ Not Met

#### Description
所有向用户显示的文本字符串必须通过国际化系统获取，不得硬编码在组件中。

#### Scenarios

##### Scenario 1: Rendering a Page Component
```
GIVEN a user with locale preference set to 'fr'
WHEN they navigate to any page (customer/staff/admin portal)
THEN all text on the page must display in French
AND no English or Chinese text should appear (除非是用户生成的内容)
```

##### Scenario 2: Displaying Toast Notifications
```
GIVEN a user performs an action that triggers a toast notification
WHEN the toast is displayed
THEN the message must be in the user's selected language
AND use the format: toast.success(t('namespace.key'))
```

##### Scenario 3: Form Validation Messages
```
GIVEN a user submits a form with invalid data
WHEN validation errors are shown
THEN all error messages must be in the user's selected language
AND use validation keys from the translation files
```

#### Implementation Rules

**✅ MUST:**
- Use `useTranslations()` hook in Client Components
- Use `getTranslations()` function in Server Components
- Store all translatable strings in `messages/*.json` files
- Provide translations for ALL supported locales

**❌ MUST NOT:**
- Hardcode any user-facing text in JSX/TSX files
- Mix languages in the same interface
- Use inline strings like `<Button>Submit</Button>`
- Concatenate translated strings (use interpolation instead)

**✅ Example - Correct:**
```tsx
// Client Component
'use client'
import { useTranslations } from 'next-intl'

export function CreateUserButton() {
  const t = useTranslations('admin.users')
  return <Button>{t('createButton')}</Button>
}

// Server Component
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('admin.users')
  return <h1>{t('title')}</h1>
}
```

**❌ Example - Incorrect:**
```tsx
// ❌ Hardcoded English
export function CreateUserButton() {
  return <Button>Create New User</Button>
}

// ❌ Hardcoded Chinese
export function SaveButton() {
  return <Button>保存</Button>
}

// ❌ Mixed languages
export function Header() {
  return <h1>用户管理 User Management</h1>
}
```

---

### REQ-I18N-002: Locale Selector Consistency

**Priority**: P0
**Status**: ⚠️ Partially Met

#### Description
语言选择器在所有页面必须使用统一的实现，语言名称必须从翻译文件获取。

#### Scenarios

##### Scenario 1: Language Selector Display
```
GIVEN a user opens the language selector dropdown
WHEN the locale options are displayed
THEN each option label must come from common.localeNames in the current locale
AND NOT be hardcoded as "English", "简体中文", etc.
```

##### Scenario 2: Language Switching
```
GIVEN a user selects a different language from the selector
WHEN the selection is made
THEN the page should reload with the new locale
AND all text should update to the new language
AND the preference should be saved (localStorage or cookie)
```

#### Implementation Rules

**✅ MUST:**
- Use the centralized `<LanguageSelector />` component
- Get locale names from `common.localeNames` translation key
- Support all 6 locales defined in `src/i18n.ts`
- Persist user's language preference

**❌ MUST NOT:**
- Create custom language selector implementations per page
- Hardcode language names in SelectItem components
- Use English names for all locales

**✅ Example - Correct:**
```tsx
import { useTranslations } from 'next-intl'
import { locales } from '@/i18n'

export function LanguageSelector() {
  const t = useTranslations('common.localeNames')

  return (
    <Select>
      {locales.map((locale) => (
        <SelectItem key={locale} value={locale}>
          {t(locale)}
        </SelectItem>
      ))}
    </Select>
  )
}
```

**❌ Example - Incorrect:**
```tsx
// ❌ Hardcoded language names
<Select>
  <SelectItem value="en">English</SelectItem>
  <SelectItem value="zh-CN">简体中文</SelectItem>
  <SelectItem value="fr">Français</SelectItem>
</Select>
```

---

### REQ-I18N-003: Toast Notification i18n

**Priority**: P0
**Status**: ❌ Not Met

#### Description
所有 Toast 通知消息必须支持国际化。

#### Scenarios

##### Scenario 1: Success Toast
```
GIVEN a user successfully completes an action (e.g., creating a user)
WHEN a success toast is displayed
THEN the message must be in the user's selected language
AND use the pattern: toast.success(t('namespace.successMessage'))
```

##### Scenario 2: Error Toast
```
GIVEN an action fails (e.g., API error)
WHEN an error toast is displayed
THEN the error message must be translated
AND may include dynamic data via interpolation
```

##### Scenario 3: Toast with Variables
```
GIVEN a toast message needs to include dynamic data
WHEN the toast is displayed
THEN use interpolation: t('message', { variable: value })
AND NOT string concatenation
```

#### Implementation Rules

**✅ MUST:**
- Define all toast messages in translation files
- Use translation keys for all toast calls
- Support variable interpolation for dynamic content
- Provide fallback messages for unexpected errors

**❌ MUST NOT:**
- Use hardcoded strings: `toast.success('User created successfully!')`
- Mix languages: `toast.error('保存失败')`
- Concatenate translated strings

**✅ Example - Correct:**
```tsx
// Translation file (en.json)
{
  "admin": {
    "users": {
      "createSuccess": "User {name} created successfully!",
      "createError": "Failed to create user",
      "deleteSuccess": "User deleted",
      "deleteError": "Failed to delete user"
    }
  }
}

// Component
const t = useTranslations('admin.users')
toast.success(t('createSuccess', { name: formData.full_name }))
toast.error(t('createError'))
```

**❌ Example - Incorrect:**
```tsx
// ❌ Hardcoded
toast.success('User created successfully!')
toast.error('保存失败')

// ❌ String concatenation
toast.success(t('created') + ' ' + name)
```

---

### REQ-I18N-004: Translation File Completeness

**Priority**: P0
**Status**: ⚠️ Partially Met

#### Description
所有支持的语言必须拥有完整且结构一致的翻译文件。

#### Requirements

1. **Structural Consistency**
   - All locale files must have identical key structures
   - No missing keys in any language
   - Same nesting hierarchy

2. **Translation Coverage**
   ```
   Priority P0 (Must Complete First):
   - common (通用文本)
   - nav (导航)
   - auth (认证)
   - errors (错误消息)
   - validation (表单验证)

   Priority P1 (Phase 2):
   - dashboard (仪表板)
   - conversations (对话)
   - tickets (工单)
   - faq (常见问题)

   Priority P2 (Phase 3):
   - admin.* (管理功能)
   - settings.* (设置)
   - complaints (投诉)
   - feedback (反馈)
   ```

3. **Quality Standards**
   - P0 languages (en, zh-CN): Human translation required
   - P1 languages (fr, es, ru, pt): AI translation + human review
   - No machine translation artifacts (e.g., literal translations that don't make sense)

#### Validation

**Automated Checks:**
```bash
# All locale files must have the same keys
npm run i18n:validate-keys

# No missing translations
npm run i18n:check-coverage

# No unused translation keys
npm run i18n:check-unused
```

**Manual Review:**
- Native speaker review for P0 languages
- Functional testing in each locale
- Screenshots for visual verification

---

### REQ-I18N-005: Form Field Labels and Placeholders

**Priority**: P0
**Status**: ❌ Not Met

#### Description
所有表单字段的标签、占位符、帮助文本必须国际化。

#### Scenarios

##### Scenario 1: Form Labels
```
GIVEN a user views a form (e.g., Create User form)
WHEN the form is rendered
THEN all field labels must be translated
AND asterisks (*) for required fields should be consistent across languages
```

##### Scenario 2: Input Placeholders
```
GIVEN a user focuses on an input field
WHEN the placeholder text is visible
THEN it must be in the user's selected language
AND provide appropriate guidance for that locale
```

##### Scenario 3: Helper Text
```
GIVEN a form field has helper text (e.g., character count)
WHEN the helper text is displayed
THEN it must use translated template with interpolation
AND format numbers according to locale conventions
```

#### Implementation Rules

**✅ MUST:**
- Use translation keys for all labels
- Use translation keys for all placeholders
- Support dynamic content via interpolation
- Include required field indicators in translations

**❌ MUST NOT:**
- Hardcode "Email Address *", "Password", etc.
- Use English placeholders in non-English locales
- Hardcode asterisks or other symbols

**✅ Example - Correct:**
```tsx
// Translation file
{
  "admin": {
    "users": {
      "form": {
        "emailLabel": "Email Address",
        "emailPlaceholder": "Enter email address",
        "emailRequired": "Email Address *",
        "characterCount": "{count}/{max} characters"
      }
    }
  }
}

// Component
const t = useTranslations('admin.users.form')

<div>
  <Label htmlFor="email">{t('emailRequired')}</Label>
  <Input
    id="email"
    type="email"
    placeholder={t('emailPlaceholder')}
  />
  <p className="text-sm text-muted-foreground">
    {t('characterCount', { count: value.length, max: 100 })}
  </p>
</div>
```

**❌ Example - Incorrect:**
```tsx
// ❌ All hardcoded
<div>
  <Label htmlFor="email">Email Address *</Label>
  <Input
    id="email"
    type="email"
    placeholder="Enter email address"
  />
  <p className="text-sm text-muted-foreground">
    {value.length}/100 characters
  </p>
</div>
```

---

### REQ-I18N-006: Dynamic Content Interpolation

**Priority**: P1
**Status**: ⚠️ Partially Met

#### Description
包含动态内容的翻译必须使用变量插值，不得使用字符串拼接。

#### Rules

**✅ MUST:**
```tsx
// Correct - Variable interpolation
t('greeting', { name: user.name })
t('itemCount', { count: items.length })
t('dateRange', { start: startDate, end: endDate })
```

**❌ MUST NOT:**
```tsx
// Wrong - String concatenation
t('hello') + ' ' + user.name
`${t('total')}: ${count}`
t('created') + ' ' + date
```

#### Translation File Format

```json
{
  "greeting": "Hello, {name}!",
  "itemCount": "You have {count} items",
  "dateRange": "From {start} to {end}",
  "withCount_one": "You have {count} item",
  "withCount_other": "You have {count} items"
}
```

---

### REQ-I18N-007: Error Message Internationalization

**Priority**: P0
**Status**: ⚠️ Partially Met

#### Description
所有错误消息（包括 API 错误、验证错误、系统错误）必须国际化。

#### Error Categories

1. **Validation Errors**
   - Required field errors
   - Format validation (email, phone, etc.)
   - Length constraints
   - Custom business logic validation

2. **API Errors**
   - Network errors
   - Server errors (500, 503, etc.)
   - Authentication errors (401, 403)
   - Not found errors (404)

3. **System Errors**
   - Unexpected errors
   - Timeout errors
   - Permission errors

#### Implementation

```tsx
// Translation file
{
  "errors": {
    "unauthorized": "Unauthorized. Please login.",
    "forbidden": "You don't have permission.",
    "notFound": "Resource not found.",
    "serverError": "Server error. Please try again.",
    "networkError": "Network error. Check your connection.",
    "validationError": "Please check your input."
  },
  "validation": {
    "required": "This field is required",
    "emailInvalid": "Invalid email address",
    "minLength": "Must be at least {min} characters",
    "maxLength": "Must be at most {max} characters"
  }
}

// Usage
const t = useTranslations('errors')
const v = useTranslations('validation')

// API error
if (error.status === 401) {
  toast.error(t('unauthorized'))
}

// Validation error
if (!email) {
  setError('email', { message: v('required') })
}
```

---

## Testing Requirements

### Manual Testing

1. **Language Switching Test**
   - Switch to each supported locale
   - Navigate through all major pages
   - Verify no hardcoded text remains
   - Check for layout issues with longer translations

2. **Form Testing**
   - Test all forms in each language
   - Verify validation messages are translated
   - Check placeholder text and labels
   - Test error scenarios

3. **Toast Testing**
   - Trigger success, error, warning toasts
   - Verify all messages are translated
   - Test with variable interpolation

### Automated Testing

```typescript
// Example test
describe('i18n Coverage', () => {
  test('all locales have same keys', () => {
    const enKeys = getAllKeys(enTranslations)
    const zhKeys = getAllKeys(zhTranslations)
    expect(enKeys).toEqual(zhKeys)
  })

  test('no hardcoded strings in components', async () => {
    const files = await glob('src/**/*.tsx')
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8')
      expect(content).not.toMatch(/>\s*[A-Z][a-z]+\s+[A-Z][a-z]+\s*</)
      expect(content).not.toMatch(/>\s*[\u4e00-\u9fa5]+\s*</)
    }
  })
})
```

---

## Migration Strategy

### Phase 1: Critical Paths (Week 1)
- [ ] Authentication pages
- [ ] Main dashboards (Customer/Staff/Admin)
- [ ] Toast notification system
- [ ] Common components (Button, Input, Label)

### Phase 2: Core Features (Week 2)
- [ ] User management (Admin)
- [ ] Conversation pages
- [ ] Ticket pages
- [ ] Settings pages

### Phase 3: Secondary Features (Week 3)
- [ ] FAQ management
- [ ] Complaints system
- [ ] Feedback system
- [ ] Advanced admin features

### Phase 4: Polish (Week 4)
- [ ] Review all translations
- [ ] Fix layout issues
- [ ] Performance optimization
- [ ] Documentation

---

## Maintenance Guidelines

### Adding New Features

When adding new UI components:
1. **Never** hardcode user-facing text
2. Add translation keys to **all** locale files
3. Use existing translation patterns
4. Test in at least 2 locales before committing

### Updating Translations

1. Update `en.json` first (source of truth)
2. Update `zh-CN.json` (primary market)
3. Update other locales (can be AI-assisted)
4. Request native speaker review for P0 languages

### Code Review Checklist

- [ ] No hardcoded strings in JSX
- [ ] All new keys added to all locale files
- [ ] Proper use of `useTranslations` / `getTranslations`
- [ ] Variable interpolation (not concatenation)
- [ ] Toast messages use translation keys
- [ ] Form labels and placeholders translated

---

## Performance Considerations

1. **Bundle Size**
   - Only load the active locale's translations
   - Tree-shake unused translation keys (future improvement)

2. **Loading Strategy**
   - Translations loaded at build time (static)
   - No runtime translation file loading
   - Fast language switching (page reload acceptable)

3. **Caching**
   - Translation files cached by Next.js
   - No additional caching needed

---

## Accessibility (a11y) Requirements

1. **Language Declaration**
   ```tsx
   <html lang={locale}>
   ```

2. **Screen Readers**
   - ARIA labels must be translated
   - Alt text must be translated
   - Error announcements must be in user's language

3. **RTL Support** (Future)
   - Not required for current locales
   - Plan for Arabic support if needed

---

## References

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [React Intl Best Practices](https://formatjs.io/docs/react-intl/)
- [i18n Best Practices](https://www.w3.org/International/questions/qa-i18n)
- [Project CLAUDE.md - i18n Section](../../CLAUDE.md#internationalization)
