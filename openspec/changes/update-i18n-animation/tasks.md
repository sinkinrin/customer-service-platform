## 1. i18n 覆盖 ✅ COMPLETED (2025-11-26)
- [x] 1.1 盘点硬编码文案（admin/customer/staff 页面与公共组件），补充到 messages/* 并通过 next-intl 渲染。
  - ✅ Admin 模块: 200 → 0 硬编码字符串
  - ✅ Customer 模块: 143 → 0 硬编码字符串
  - ✅ Staff 模块: 140 → 0 硬编码字符串
  - ✅ 共 633 个硬编码字符串已全部消除
- [x] 1.2 语言选择器与 locale 名称统一从翻译文件读取，不留英文硬编码或混排。
  - ✅ 使用 `common.localeNames` 翻译
- [x] 1.3 校验表单/Toast/按钮等提示的翻译占位与插值，避免 fallback 英文。
  - ✅ `npm run i18n:validate` 全部通过
  - ✅ 6 种语言 × 1168 个键 = 完全一致

**验证命令**:
```bash
npm run i18n:validate     # ✅ All validations passed!
npm run i18n:detect-hardcoded  # ✅ 0 issues (4个Promise是TypeScript类型注解误报)
node scripts/find-untranslated.js  # 检测未翻译的英文键
```

### 1.4 翻译质量审查 ✅ COMPLETED (2025-11-26)

**✅ 已完成 (Session 1-2)**:
- [x] 修复 fr/es/ru/pt 缺失的 8 个 nav.customer 键
- [x] 完成所有语言的 P0-P3 全部模块翻译:
  - ✅ common.* (time, layout, empty, errorBoundary, aria)
  - ✅ nav.* (包括 customer 子命名空间)
  - ✅ auth.* (login, register, accessDenied)
  - ✅ dashboard.*
  - ✅ conversations.*
  - ✅ admin.* (207 keys × 4 languages)
  - ✅ customer.* (194 keys × 4 languages)
  - ✅ staff.* (174 keys × 4 languages)
  - ✅ faq.*, tickets.*, settings.*, toast.*
  - ✅ complaints.*, myTickets.*, components.*, marketing.*, landing.*

**📊 最终翻译完成度**:
- 🇨🇳 zh-CN: **99%** - 仅11个技术术语保留英文 (FastGPT, AI, Email placeholders)
- 🇫🇷 fr: **95%** - 55个同源词/品牌名保持英文 (Conversations, FAQ, Email - 法语同词)
- 🇪🇸 es: **98%** - 22个同源词/品牌名保持英文 (Error, No, Normal - 西班牙语同词)
- 🇷🇺 ru: **99%** - 10个技术术语保留英文 (Email, FastGPT, FleetCommand)
- 🇵🇹 pt: **97%** - 30个同源词/品牌名保持英文 (Status, Tickets, Normal - 葡语借词)

**✅ 验证结果**:
```bash
npm run i18n:validate     # ✅ All validations passed!
# - Structural consistency: PASSED (all 6 locales)
# - Interpolation consistency: PASSED
# - Empty values: PASSED
```

**📝 说明**:
- `find-untranslated.js` 报告的"未翻译"项大多是:
  1. 品牌名称 (FleetCommand, FastGPT) - 应保持英文
  2. 技术术语 (Email, AI, URL, Temperature) - 国际通用
  3. 同源词/借词 (Conversations, FAQ, Status) - 目标语言中使用相同词汇
  4. Email 占位符 (user@example.com) - 技术示例
  5. 格式字符串 ({count} / 300) - 数字格式

## 2. 动画与加载规范 ✅ COMPLETED (2025-11-26)
- [x] 2.1 为 skeleton/shimmer/page loader/page transition 添加 prefers-reduced-motion 降级或关闭策略。
  - ✅ globals.css 添加全局 `@media (prefers-reduced-motion: reduce)` 规则
  - ✅ 所有 `animate-spin`, `animate-pulse`, `animate-bounce`, `animate-fade-in` 添加 `motion-reduce:animate-none`
  - ✅ Skeleton 组件已有 `motion-reduce:animate-none`
  - ✅ PageTransition 组件已有 `motion-reduce:animate-none`
  - ✅ PageLoader 组件添加 `motion-reduce:animate-none`
  - ✅ 受影响文件: page.tsx, conversations/page.tsx, customers/page.tsx, message-list.tsx, search-bar.tsx, conversation-header.tsx, recent-activity.tsx, conversation-summary.tsx, admin/dashboard, staff/tickets, admin/tickets

- [x] 2.2 统一过渡/阴影/blur 用变量或类封装，避免各页面私自定义。
  - ✅ globals.css 添加 CSS 变量:
    - `--transition-fast`, `--transition-normal`, `--transition-slow`
    - `--ease-default`, `--ease-in`, `--ease-out`
    - `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-hover`
  - ✅ 添加工具类: `.transition-default`, `.transition-colors-fast`, `.transition-shadow-normal`, `.shadow-hover-effect`

- [x] 2.3 更新对话框/加载组件的可滚动性与焦点可达性，确保动画不会影响可访问性。
  - ✅ Dialog 组件: `max-h-[calc(100vh-4rem)] overflow-y-auto` 保证可滚动
  - ✅ Dialog 组件: 添加 `motion-reduce:animate-none motion-reduce:duration-0`
  - ✅ AlertDialog 组件: 同步添加滚动支持和 motion-reduce 处理
  - ✅ PageLoader: 已有 `role="status"` 和 `aria-live="polite"`，添加 `aria-hidden="true"` 到装饰性元素
  - ✅ Loading 组件: 已有 `role="status"` 和 `aria-label`，添加 motion-reduce 处理
