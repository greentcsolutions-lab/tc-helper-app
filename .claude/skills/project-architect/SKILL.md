---
name: project-architect
description: Guides folder & file structure decisions for Next.js App Router projects using TypeScript. Triggered via prompt-classifier on PLANNING / IMPLEMENT / EDIT phases when phrases like "plan-structure", "where to put", "colocate", "new feature", "add route" appear. Treats TREE.md as the single source of truth. Proposes minimal, colocated changes. Chains full implementation flow only after explicit user approval.
priority: high
triggers: [plan-structure, structure, organize, folder, directory, new feature, add route, where to put, colocate, architecture, file location, project structure]
stage: planning, implement, edit
---

# Project Architect – Next.js App Router Structure Guide

## Mandatory Rules – Violation = Immediate Failure
- You **MUST** read the **full content** of TREE.md at the very beginning of **every single invocation** before thinking or responding.
- You are **strictly forbidden** from assuming, guessing, inventing, or hallucinating any part of the current folder structure.
- Every proposal **must** be based **exclusively** on the TREE.md content that was just read in this turn.
- Prefer **colocation** inside route folders > route groups `(group)` > shared folders (`src/lib/`, `src/components/`, etc.)
- Only suggest global/shared locations when the item is clearly reused in **≥ 3 places** or is foundational infrastructure.

## Strict Decision Preferences (ranked – follow order)
1. Colocate inside the most relevant route folder (`app/dashboard/settings/...`, `app/(auth)/login/...`)
2. Use route groups for logical separation without affecting URL (`app/(marketing)/`, `app/(app)/`)
3. Place in feature folders only if the feature is clearly cross-cutting but still domain-specific (`app/_features/user-profile/...`)
4. Global shared locations (`src/lib/`, `src/hooks/`, `src/components/ui/`, `src/utils/`) **only** when:
   - item is truly generic AND
   - expected reuse across ≥ 3 unrelated features OR
   - it's a foundational utility (env, auth config, db client, etc.)

## Process (do not skip steps)
1. Read and internally parse the full TREE.md (focus on the tree diagram block)
2. Identify the main entities from the user prompt (page, layout, component, server action, route handler, hook, util, type, schema, etc.)
3. Select best location following the ranked preferences above
4. Propose **minimal** additions/moves/renames
5. Show clear before/after excerpts of the relevant subtree
6. Ask for explicit approval before any file operations

## Final Output Rules – Critical
- Respond **ONLY** with the exact format shown below — **nothing** else
- No extra explanations, greetings, apologies, markdown fences outside the blocks, questions, or continuation after the approval line
- Use ```tree ... ``` code blocks for all tree excerpts
- Do **not** write any file content — only propose paths

## Exact Output Format

Current TREE.md excerpt (relevant part):
```tree
app/
  dashboard/
    page.tsx
    layout.tsx
```

Proposed structure change:

Before (relevant excerpt):
```tree
app/
  dashboard/
    page.tsx
    layout.tsx
```

After (proposed):
```tree
app/
  dashboard/
    page.tsx
    layout.tsx
    settings/
      page.tsx          # new
      loading.tsx       # new (optional)
```

Files to create / move:
- app/dashboard/settings/page.tsx                (new page)
- app/dashboard/settings/loading.tsx             (new optional loading state)

Rationale:
- Colocation keeps the settings feature self-contained and reduces cognitive load
- Keeps related files close → shorter import paths
- Avoids premature abstraction into shared folders

Trade-offs:
- Colocated: easier to reason about this feature, but risk of later duplication if same pattern needed elsewhere
- Global: better reuse potential, but increases coupling and makes large refactors harder

Approval:
Create proposed folders/files? (yes / no)
If yes, attempt to chain (in order, skip unavailable steps):
→ clean-code-guardian
→ scalability-strategist
→ security-overseer
→ write / edit files
→ test-writer
→ verification-guardian
→ commit-orchestrator (must run last – responsible for updating TREE.md)