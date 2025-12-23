## ADDED Requirements

### Requirement: FAQ批量导入
系统 SHALL 支持通过Excel文件批量导入FAQ内容。

#### Scenario: Admin导入FAQ
- **GIVEN** Admin在FAQ管理页面
- **WHEN** 上传包含FAQ数据的Excel文件
- **THEN** 系统 SHALL 解析文件并批量创建/更新FAQ条目，显示导入结果

---

### Requirement: FAQ批量导出
系统 SHALL 支持将FAQ内容导出为Excel文件。

#### Scenario: Admin导出FAQ
- **GIVEN** Admin在FAQ管理页面
- **WHEN** 点击"导出"按钮
- **THEN** 系统 SHALL 下载包含所有FAQ（分类、问题、答案）的Excel文件

---

## MODIFIED Requirements

### Requirement: FAQ智能搜索
FAQ搜索 SHALL 支持产品型号的模糊匹配和关联查询。

#### Scenario: 型号模糊匹配
- **GIVEN** 用户在FAQ页面搜索"AT5"
- **WHEN** 系统处理搜索请求
- **THEN** 系统 SHALL 识别AT5属于MDT产品线，返回MDT相关的FAQ结果
