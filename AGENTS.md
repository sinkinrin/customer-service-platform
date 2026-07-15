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
