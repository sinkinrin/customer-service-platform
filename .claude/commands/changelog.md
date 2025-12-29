---
description: Generate CHANGELOG from git commits with auto-archiving
allowed-tools: Bash, Read, Write, Edit, Glob
---

# Changelog Generator

You are a **Release Notes Editor**. Generate a Chinese CHANGELOG based on git commit history following Conventional Commits format, with automatic archiving of old versions.

## User Request

$ARGUMENTS

## Step 0: Check Archive Status (IMPORTANT - Do This First!)

Before generating new changelog, check if archiving is needed:

```bash
# Check current CHANGELOG size
wc -l CHANGELOG.md
du -h CHANGELOG.md

# Check if archive directory exists
ls -la changelogs/ 2>/dev/null || echo "Archive directory does not exist"
```

### Archive Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Lines | > 800 lines | Archive old versions |
| Size | > 80 KB | Archive old versions |
| Versions | > 10 detailed versions | Archive oldest versions |

### If Archiving Needed

1. **Create archive directory** (if not exists):
```bash
mkdir -p changelogs
```

2. **Identify versions to archive**:
   - Keep the **5 most recent versions** with full details in CHANGELOG.md
   - Move older versions to `changelogs/CHANGELOG-YYYY.md` (by year)

3. **Create/update archive file**:
```markdown
# Changelog Archive - YYYY

This file contains archived changelog entries from YYYY.

For recent changes, see [CHANGELOG.md](../CHANGELOG.md).

---

## [0.1.5] - 2025-11-18
(moved content...)

## [0.1.4] - 2025-11-18
(moved content...)
```

4. **Update main CHANGELOG.md**:
   - Remove archived version details
   - Add archive reference section at the bottom:
```markdown
---

## 📚 历史版本

更早的版本记录已归档：

| 年份 | 文件 | 版本范围 |
|------|------|----------|
| 2025 | [changelogs/CHANGELOG-2025.md](changelogs/CHANGELOG-2025.md) | v0.1.0 - v0.1.9 |
```

## Step 1: Gather Information

Run these commands to get the necessary context:

```bash
# Get current version from CHANGELOG.md
head -20 CHANGELOG.md

# Get recent commits (adjust range as needed)
git log --oneline -30

# Get detailed commit info for changelog generation
git log --pretty=format:"%H|%s" -30
```

If user specifies a version range (e.g., "v0.3.0..v0.3.1"), use:
```bash
git log <PREV_TAG>..<CUR_TAG> --pretty=format:"%H|%s"
```

## Step 2: Determine Version Number

Based on commits, follow semantic versioning:

1. **Major (X.0.0)** - Breaking changes
   - Check for `BREAKING CHANGE:` in commit body
   - Check for `!` after type (e.g., `feat!:`, `fix!:`)
   - If found: increment major, reset minor and patch to 0

2. **Minor (X.Y.0)** - New features
   - Check for `feat:` commits (without breaking changes)
   - If found: increment minor, reset patch to 0

3. **Patch (X.Y.Z)** - Bug fixes
   - Check for `fix:` commits (without features or breaking)
   - If found: increment patch

4. **No version change**
   - Only `docs:`, `style:`, `refactor:`, `chore:` commits
   - Can optionally treat as patch release

## Step 3: Categorize Commits

Group commits by type with Chinese headers:

| Commit Type | Chinese Header |
|-------------|----------------|
| `feat:` | `### ✨ 新增` |
| `fix:` | `### 🐛 修复` |
| `docs:` | `### 📝 文档` |
| `refactor:` | `### 🔧 重构` |
| `chore:` | `### 📦 杂务` |
| `style:` | `### 🎨 风格` |
| `perf:` | `### ⚡ 性能优化` |
| `test:` | `### 🧪 测试` |
| `security:` or security fixes | `### 🔒 安全` |

## Step 4: Generate Changelog Entry

Format each entry as:
```markdown
## [X.Y.Z] - YYYY-MM-DD

### ✨ 新增

#### Feature Title
- **文件**: `path/to/file.ts`
- **变更**: Description of changes
- **影响**: Impact on users/system

### 🐛 修复

#### Bug Fix Title
- **文件**: `path/to/file.ts`
- **问题**: What was wrong
- **修复**: How it was fixed
- **影响**: What works now
```

## Step 5: Clean Up

- **Remove noise**: Merge/debug/format commits with no info
- **Consolidate**: Group related small commits
- **Keep representative links**: For merged commits, keep 1-3 representative commit hashes
- **Use Chinese**: All descriptions in Chinese

## Output Format

```markdown
## [NEW_VERSION] - YYYY-MM-DD

### ✨ 新增
- ...

### 🐛 修复
- ...

### 📝 文档
- ...

### 🔧 重构
- ...

### 📦 杂务
- ...

### ⚡ 性能优化
- ...

---
```

**Note**: If a section is empty, omit it entirely.

## Example Output

```markdown
## [0.4.0] - 2025-12-24

### ✨ 新增

#### 用户头像上传功能
- **文件**: `src/components/profile/avatar-upload.tsx`
- **变更**:
  - 支持拖拽上传图片
  - 支持裁剪和预览
  - 自动压缩大图片
- **影响**: 用户可以自定义个人头像

### 🐛 修复

#### 修复登录状态丢失问题
- **文件**: `src/lib/auth.ts`
- **问题**: 页面刷新后用户被登出
- **修复**: 正确持久化 JWT token 到 localStorage
- **影响**: 登录状态在页面刷新后保持

### 📦 依赖更新

- 更新: `next@16.0.1` -> `next@16.0.2`
- 新增: `sharp@0.33.0` - 图片处理库
```

## After Generation

### Standard Flow:
1. Show the generated changelog entry to the user
2. Ask if they want to prepend it to CHANGELOG.md
3. If yes, update CHANGELOG.md (insert after the header, before existing entries)

### If Archiving Was Triggered:
1. Report what was archived:
   ```
   📦 已归档旧版本:
   - v0.1.0 ~ v0.1.5 → changelogs/CHANGELOG-2025.md
   - CHANGELOG.md 从 842 行精简到 420 行
   ```
2. Show the new changelog entry
3. Update CHANGELOG.md with new entry

## Archive Directory Structure

```
project-root/
├── CHANGELOG.md              ← Recent 5-10 versions (detailed)
└── changelogs/
    ├── CHANGELOG-2025.md     ← Archived 2025 versions
    ├── CHANGELOG-2024.md     ← Archived 2024 versions
    └── ...
```

## Special Commands

User can also request:
- `/changelog archive` - Manually trigger archiving without generating new entry
- `/changelog status` - Show current file size and version count
- `/changelog restore v0.1.5` - Restore a specific archived version to view
