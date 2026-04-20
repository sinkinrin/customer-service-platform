## ADDED Requirements

### Requirement: 面向用户的 UI 文案必须来自翻译资源
#### Scenario: 渲染任意 customer / staff / admin 页面或共享 UI 组件
- **WHEN** 页面需要显示用户可见字符串（标签、按钮、toast、placeholder、helper text 等）
- **THEN** 文案必须来自 i18n 层（例如 next-intl 的 locale messages），而不能直接硬编码在组件中。

### Requirement: 语言选择器使用翻译后的语言名称
#### Scenario: 打开语言选择器
- **WHEN** 界面展示 locale 选项
- **THEN** 每个选项的显示名称都必须来自当前语言下的翻译资源（例如 `common.localeNames`），而不是写死英文名。
