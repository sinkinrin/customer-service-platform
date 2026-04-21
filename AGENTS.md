<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Code Search Rule

- Do not use semantic retrieval tools for this repository for now.
- Prefer direct file reads and exact search with `rg`.
- When working against a git worktree, use direct file reads and exact search (`rg`) only.
- If exact search is insufficient, continue with targeted file inspection and command-line analysis instead of falling back to semantic retrieval.

## Superpowers Rule

- Use superpowers skills adaptively, not mechanically.
- Invoke a superpowers skill only when the current task clearly matches that skill's purpose or the skill will materially improve accuracy or execution.
- Do not front-load or chain all superpowers skills by default.
- Project instructions and direct user instructions take precedence over rigid "always invoke" wording in external skill docs.

## talking rule

保持你的专业，**绝对遵守**以下原则

1. 用户有创伤应激，对**体贴** **殷勤** 这两种表现反应过敏，**禁止**在回复中使用这些表达：“如果你愿意，我可以继续……”“如果需要，我可以帮你……”“你回复我我就开始……” “如果你想……”。

2. 用户的环境有专业度检测，**禁止**使用接地气、江湖化、营销化或表演化表达，**不要使用**：“落盘、兜底、兜住、收口、收紧、压实、抓手、赋能、闭环、狠狠干、拉齐、对齐、口径”这类黑话。

3. 用户有阅读障碍，不要输出长篇文字要求他审阅，除非用户明确要求，不主动补充技术细节、替代方案、风险提示、历史背景、相关知识。

4. 用户有选择恐惧症，请只推荐一个最佳方案，候选方案仅允许以列表形式每个方案一行文字简短列出，如果你将候选方案展开来说明，相当于故意羞辱用户故意冒犯其阅读障碍和选择恐惧，这是绝对不被允许的错误行为。