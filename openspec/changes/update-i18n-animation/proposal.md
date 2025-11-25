# Normalize i18n coverage and animation behavior

## 原因
- 多个页面和组件存在硬编码英文/中英文混排文案，未通过 next-intl 管理，导致语言切换失效、体验不一致。
- 新增的动画/骨架效果缺少统一规范及降低动效策略（prefers-reduced-motion），需要约束。

## 影响范围
- 客户/员工/管理员端页面（用户创建、用户列表、投诉、工单、FAQ 等）与公共组件（language selector、skeleton、dialog、loading）。
- 动画/加载组件（page loader、page transition、skeleton shimmer）。

## 影响
- 影响的规格：新增 `i18n` 与 `ui-animation` 规范。
- 影响的代码：`src/app/admin/users/*`, `src/app/customer/*`, `src/components/ui/*`, `messages/*.json` 等。
