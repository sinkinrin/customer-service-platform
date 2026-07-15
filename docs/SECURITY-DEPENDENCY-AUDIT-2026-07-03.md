# 依赖安全审计（2026-07-03）

> 本次记录只覆盖主仓库根项目 `package.json` / `package-lock.json`。

## 审计范围

- 根项目生产依赖：`npm audit --omit=dev --json`
- 根项目完整依赖：`npm audit --json`
- 依赖路径确认：`npm explain ...`

**排除范围**：`Yuxi-Know/` 虽然存在独立 manifests，但当前被 `.gitignore` 排除，不计入主仓库基线。

## 初始发现

### 运行时 / 生产风险

- `js-cookie` HIGH
  - `GHSA-qjx8-664m-686j`
- `dompurify` MODERATE
  - `GHSA-76mc-f452-cxcm`
  - `GHSA-hpcv-96wg-7vj8`
  - `GHSA-r47g-fvhr-h676`
  - `GHSA-cmwh-pvxp-8882`
  - 以及同批次低危补丁公告
- `js-yaml` MODERATE
  - `GHSA-h67p-54hq-rp68`
  - 主要经 `next-swagger-doc` / `swagger-parser` 链路进入，也同时存在于 eslint 链路

### 开发 / 测试工具链风险

- `vitest` CRITICAL
  - `GHSA-5xrq-8626-4rwp`
- `@vitest/ui` / `@vitest/coverage-v8` 受同一问题影响
- `vite` HIGH / MODERATE
  - `GHSA-v6wh-96g9-6wx3`
  - `GHSA-fx2h-pf6j-xcff`
- `ws` HIGH / MODERATE
- `@babel/core` LOW

## 本次整改

### 直接升级的依赖

- `js-cookie` → `^3.0.8`
- `dompurify` → `^3.4.11`
- `vitest` → `^4.1.9`
- `@vitest/ui` → `^4.1.9`
- `@vitest/coverage-v8` → `^4.1.9`
- `@vitejs/plugin-react` → `^5.2.0`
- `jsdom` → `^27.4.0`
- `vite` → `^8.1.3`（显式加入 devDependencies，锁定到已修复版本）

### 额外处理

- 在 `package.json` 中新增 `overrides.js-yaml = 5.2.1`
- 目的：覆盖 `next-swagger-doc` / `swagger-parser` 与 eslint 链路中锁定到 `^4.1.0` 的旧 `js-yaml`

## 整改后结果

重新执行：

```bash
npm audit --json
npm audit --omit=dev --json
```

结果：

- 生产依赖漏洞：`0`
- 完整依赖漏洞：`0`

## 当前锁定结果（节选）

- `js-cookie@3.0.8`
- `dompurify@3.4.11`
- `vitest@4.1.9`
- `vite@8.1.3`
- `ws@8.21.0`
- `@babel/core@7.29.7`
- `js-yaml@5.2.1`（override）

## 备注

- `js-yaml` 的清零依赖于 override，而不是上游包自行发布兼容修复版本
- 之后如果升级 `next-swagger-doc` / `swagger-parser` 链路，应重新确认 override 是否仍然需要
- 安全审计结论只代表 **2026-07-03 审计时刻** 的 npm advisory 结果，之后仍需周期性复查