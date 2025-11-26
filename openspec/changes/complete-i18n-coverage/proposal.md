# Complete i18n Coverage for Customer Service Platform

## 背景 (Background)

当前系统虽然已集成 next-intl 4.4.0 并支持 6 种语言（en, zh-CN, fr, es, ru, pt），但代码库中仍存在大量硬编码文本（英文/中文/混排），导致：

1. **语言切换失效**：用户切换语言后，部分界面文本不会改变
2. **体验不一致**：同一页面中出现中英文混排或多语言混用
3. **维护困难**：翻译分散在代码中，难以统一管理和更新
4. **国际化受限**：新增语言时需要大量代码修改

## 原因 (Reason)

通过 acemcp 代码检索发现以下问题区域：

### 1. Toast 消息硬编码（24 个文件）
- ❌ `toast.success('User created successfully!')`
- ❌ `toast.error('保存失败')`
- ✅ 应使用：`toast.success(t('admin.users.createSuccess'))`

### 2. 页面标签和占位符硬编码

#### Admin 页面（英文硬编码）
- `src/app/admin/users/create/page.tsx`: "Create New User", "Email Address *", "Back to Users"
- `src/components/admin/faq-form-dialog.tsx`: "Title *", "Content *", "Cancel", "Create Article"

#### Customer 页面（中文硬编码）
- `src/app/customer/settings/page.tsx`: "电话", "语言", "请输入您的电话号码", "保存中...", "保存更改"

#### Staff 页面（中英文混排）
- `src/app/staff/conversations/page.tsx`: "新的转人工对话", "原因："
- `src/app/staff/settings/page.tsx`: 语言选择器硬编码

### 3. 语言选择器不一致
- ✅ `src/components/language-selector.tsx`: 正确使用 `tCommon(loc)`
- ❌ `src/app/staff/settings/page.tsx`: 硬编码 "English", "简体中文"
- ❌ `src/app/customer/settings/page.tsx`: 硬编码语言名称

### 4. 表单验证和错误消息
- 部分使用翻译文件，部分硬编码
- 缺少统一的错误处理翻译机制

## 影响范围 (Scope)

### 影响的代码文件（主要）
```
src/app/admin/
├── users/create/page.tsx           # 硬编码英文
├── users/page.tsx                  # 硬编码英文
├── settings/page.tsx               # 硬编码英文
├── faq/page.tsx                    # 硬编码英文
└── tickets/[id]/page.tsx           # 硬编码英文

src/app/customer/
├── settings/page.tsx               # 硬编码中文
├── complaints/page.tsx             # Toast 消息硬编码
├── feedback/page.tsx               # Toast 消息硬编码
└── my-tickets/page.tsx             # Toast 消息硬编码

src/app/staff/
├── conversations/page.tsx          # 硬编码中文
├── settings/page.tsx               # 语言选择器硬编码
└── tickets/[id]/page.tsx           # Toast 消息硬编码

src/components/
├── admin/faq-form-dialog.tsx       # 硬编码英文
├── conversation/message-input.tsx  # Toast 消息硬编码
└── layouts/*.tsx                   # 部分硬编码
```

### 影响的翻译文件
```
messages/
├── en.json        # 需要补充缺失的键
├── zh-CN.json     # 需要补充缺失的键
├── fr.json        # 需要补充所有键
├── es.json        # 需要补充所有键
├── ru.json        # 需要补充所有键
└── pt.json        # 需要补充所有键
```

## 提案目标 (Objectives)

### 主要目标
1. **100% i18n 覆盖**：所有面向用户的文本必须通过翻译系统
2. **统一翻译机制**：建立标准的翻译使用模式和规范
3. **完整的翻译文件**：所有 6 种语言的翻译键完整且准确
4. **可维护性**：翻译集中管理，易于更新和扩展

### 次要目标
1. 建立 i18n 最佳实践文档
2. 添加翻译键完整性检查工具
3. 改进语言切换体验（实时切换）

## 影响 (Impact)

### 影响的规范
- **新增规范**：`openspec/changes/complete-i18n-coverage/specs/i18n-requirements.md`
- **更新规范**：现有的 UI 组件规范需要添加 i18n 要求

### 影响的系统
- ✅ 所有用户界面（Customer/Staff/Admin Portal）
- ✅ Toast 通知系统
- ✅ 表单验证系统
- ✅ 错误处理系统
- ⚠️ API 响应消息（可选，建议后续处理）

### 向后兼容性
- ✅ **完全兼容**：仅替换硬编码文本为翻译调用
- ✅ **无破坏性变更**：不影响现有功能和 API
- ✅ **渐进式改进**：可按模块逐步实施

## 预期收益 (Benefits)

### 用户体验
1. **真正的多语言支持**：语言切换后所有文本都能正确显示
2. **一致性体验**：消除中英文混排，界面更专业
3. **更好的可访问性**：支持更多语言的用户

### 开发效率
1. **集中管理**：所有翻译在一处，便于更新
2. **易于扩展**：新增语言只需添加翻译文件
3. **减少错误**：消除硬编码带来的遗漏和不一致

### 产品价值
1. **国际化就绪**：真正支持全球化部署
2. **专业形象**：统一、准确的多语言界面
3. **降低维护成本**：翻译更新无需修改代码

## 实施计划 (Implementation Plan)

详见 `tasks.md`

## 验收标准 (Acceptance Criteria)

1. ✅ 所有 `.tsx` 文件中的用户可见文本都通过 `useTranslations()` 或 `getTranslations()` 获取
2. ✅ 所有 6 种语言的翻译文件包含相同的键结构
3. ✅ Toast 消息支持国际化
4. ✅ 语言选择器在所有页面使用统一实现
5. ✅ 通过翻译键完整性测试（所有语言文件结构一致）
6. ✅ 语言切换后页面文本完全更新（无硬编码残留）

## 风险与缓解 (Risks and Mitigation)

### 风险 1：翻译工作量大
- **影响**：6 种语言 × 数百个翻译键
- **缓解**：
  1. 优先完成 en 和 zh-CN（主要用户群）
  2. 使用 AI 翻译工具辅助（需人工审核）
  3. 分阶段实施，逐步完成

### 风险 2：遗漏硬编码
- **影响**：可能有未被发现的硬编码文本
- **缓解**：
  1. 使用自动化工具扫描（正则匹配中英文字符串）
  2. 进行多语言测试，切换语言检查
  3. Code Review 强制检查

### 风险 3：翻译质量
- **影响**：机器翻译可能不准确
- **缓解**：
  1. en 和 zh-CN 人工翻译（核心语言）
  2. 其他语言使用 AI + 人工审核
  3. 接受用户反馈持续改进

## 相关文档 (Related Documents)

- [CLAUDE.md - Internationalization Section](../../CLAUDE.md#internationalization)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Project Context - i18n](../../PROJECT-CONTEXT.md)
- [Existing i18n Spec](../update-i18n-animation/specs/i18n/spec.md)

## 变更历史 (Change History)

| 日期 | 版本 | 作者 | 变更说明 |
|------|------|------|----------|
| 2025-11-25 | 1.0 | Claude Code | 初始提案，基于 acemcp 代码检索分析 |
