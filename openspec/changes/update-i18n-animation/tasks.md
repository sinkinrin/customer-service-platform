## 1. i18n 覆盖
- [ ] 1.1 盘点硬编码文案（admin/customer/staff 页面与公共组件），补充到 messages/* 并通过 next-intl 渲染。
- [ ] 1.2 语言选择器与 locale 名称统一从翻译文件读取，不留英文硬编码或混排。
- [ ] 1.3 校验表单/Toast/按钮等提示的翻译占位与插值，避免 fallback 英文。

## 2. 动画与加载规范
- [ ] 2.1 为 skeleton/shimmer/page loader/page transition 添加 prefers-reduced-motion 降级或关闭策略。
- [ ] 2.2 统一过渡/阴影/blur 用变量或类封装，避免各页面私自定义。
- [ ] 2.3 更新对话框/加载组件的可滚动性与焦点可达性，确保动画不会影响可访问性。
