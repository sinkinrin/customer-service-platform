---
description: Create or manage OpenSpec change proposals
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# OpenSpec Change Proposal Management

You are helping the user create or manage OpenSpec change proposals for this project.

## Context

This project uses OpenSpec for structured requirements management. Read the following files first:
- `openspec/AGENTS.md` - Complete workflow instructions
- `openspec/project.md` - Project conventions
- `openspec/README.md` - Overview

## User Request

$ARGUMENTS

## Workflow

### Step 1: Understand the Request

Determine what the user wants:
1. **Create new proposal** - User wants to add a feature, make breaking changes, or modify architecture
2. **View existing proposals** - User wants to see pending changes
3. **Implement proposal** - User wants to execute tasks from an existing proposal
4. **Archive proposal** - User wants to mark a change as complete

### Step 2: Check Existing Context

Before creating anything new, run these commands:
```bash
npx openspec list              # List pending changes
npx openspec list --specs      # List existing specs
```

Search for conflicts:
```bash
ls openspec/changes/           # See all pending changes
ls openspec/specs/             # See all feature specs
```

### Step 3: For New Proposals

If creating a new proposal:

1. **Choose a unique change-id** (kebab-case, verb-prefix):
   - `add-` for new features
   - `update-` for modifications
   - `remove-` for deprecations
   - `refactor-` for restructuring
   - `optimize-` for performance
   - `fix-` for bug fixes (only if behavior change)

2. **Create directory structure**:
```
openspec/changes/<change-id>/
├── proposal.md     # Required: Why, What, Impact
├── tasks.md        # Required: Implementation checklist
├── design.md       # Optional: Technical decisions (if complex)
└── specs/          # Required: Spec deltas
    └── <feature>/
        └── spec.md # ADDED/MODIFIED/REMOVED requirements
```

3. **Write proposal.md**:
```markdown
# Change: [Brief description]

## Why
[1-2 sentences about the problem/opportunity]

## What Changes
- [List of changes]
- [Mark breaking changes with **BREAKING**]

## Impact
- Affected specs: [list features]
- Affected code: [key files/systems]
```

4. **Write tasks.md**:
```markdown
## 1. Implementation
- [ ] 1.1 Task description
- [ ] 1.2 Task description
...

## 2. Testing
- [ ] 2.1 Write unit tests
- [ ] 2.2 Manual verification
```

5. **Write spec delta** (specs/<feature>/spec.md):
```markdown
## ADDED Requirements
### Requirement: New Feature Name
The system SHALL provide...

#### Scenario: Success case
- **WHEN** user performs action
- **THEN** expected result

## MODIFIED Requirements
### Requirement: Existing Feature Name
[Full modified requirement text with scenarios]

## REMOVED Requirements
### Requirement: Old Feature Name
**Reason**: [Why removing]
**Migration**: [How to handle]
```

### Step 4: Validate

After creating files, run:
```bash
npx openspec validate <change-id> --strict
```

Fix any validation errors before presenting the proposal.

## Important Rules

1. **Every requirement MUST have at least one `#### Scenario:`**
2. **MODIFIED requirements must include the FULL updated text** (not just changes)
3. **Use kebab-case for change-id**, always unique
4. **Check for conflicts** with existing changes before creating
5. **Skip proposals for**: bug fixes, typos, dependency updates, config changes

## Output

After completing the task:
1. Show the user what was created/modified
2. Provide next steps (validation, implementation, etc.)
3. If creating a proposal, ask if they want to proceed with implementation
