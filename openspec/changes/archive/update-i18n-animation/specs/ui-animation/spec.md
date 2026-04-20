## ADDED Requirements

### Requirement: 动效必须尊重 reduced motion 偏好
#### Scenario: 用户设置了 `prefers-reduced-motion: reduce`
- **WHEN** skeleton、loader、transition、shimmer 等动效被渲染
- **THEN** 系统应禁用或显著减弱这些动画效果（例如不再使用 shimmer / pulse），同时保证内容仍然可见。

### Requirement: 加载态与过渡效果保持一致风格
#### Scenario: 页面展示加载态或过渡效果
- **WHEN** page loader 或 transition 被显示
- **THEN** 它们应复用统一的样式 / token（如 timing、easing、shadow、blur），避免每个页面各自定义一套动画参数。
