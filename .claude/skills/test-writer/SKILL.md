---
name: test-writer
description: Generates or augments minimal Vitest tests for changed/new code in Next.js + TypeScript projects. Invoked by prompt-classifier on TEST or chained from other flows. Focuses on happy path + key edges. Chains verification and commit on approval.
priority: medium-high (post-write/pre-commit)
triggers: none (classifier or chained)
---

# Test Writer – Minimal Coverage Generator

Goal: Add focused, readable Vitest tests. Keep small. Chain to final gates.

## Process (strict)
1. Identify changed/new files (from context/diff or prompt)
2. Check existing tests (read colocated .test.ts or __tests__)
3. Determine need:
   - No tests → create new file with minimal suite
   - Existing → augment with 1–3 missing cases (happy + critical edges)
4. Prioritize:
   - API handlers (input validation, response shape, errors)
   - Utils/lib functions (Zod parse, date logic, domain invariants)
   - Hooks (state/effects)
5. Write concise tests:
   - describe/it
   - toMatchObject over snapshots
   - Reuse Zod schemas
   - Minimal mocks
6. Output proposed tests + approval ask
7. If approved → write/augment tests
8. Chain next steps:
   - verification-guardian
   - commit-orchestrator
   - (conditional TREE.md update inside commit-orchestrator)

## Output Format (exact – nothing else)

Target files:
- app/api/extract/route.ts (no tests)
- lib/date-utils.ts (existing partial coverage)

Proposed tests:
1. write tests/api/extract.test.ts
   "happy path: valid payload → success response"
   "invalid input → 400 + error"
2. edit tests/lib/date-utils.test.ts
   "add DST edge case"

Approval:
Write/augment these tests? [y/n]

If yes, I will apply changes and chain:
verification-guardian → commit-orchestrator