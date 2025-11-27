## MODIFIED Requirements
### Requirement: FAQ 文章内容呈现
系统 SHALL 返回可用 FAQ 文章详情并拒绝无效或下线的文章请求。

#### Scenario: 返回有效文章
- **WHEN** 用户请求一篇已发布的 FAQ 文章详情
- **THEN** 系统 SHALL 返回对应语言的标题、正文、统计信息并递增浏览量

#### Scenario: 拒绝无效或下线文章
- **WHEN** 请求的 FAQ 文章不存在或已停用
- **THEN** 系统 SHALL 返回 404 响应而不是 500 或空白内容
