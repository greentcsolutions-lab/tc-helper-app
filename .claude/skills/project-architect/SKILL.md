---
name: project-architect
description: Guides project structure decisions for Next.js App Router projects. Use when creating new routes/features/components, suggesting folder organization, refactoring file locations, or auditing structure. Triggers on: structure, organize, folder, directory, new feature, add route, where to put, colocate, architecture.
---

# Project Architect – Structure Decision Maker

Follow tchelper.app conventions from CLAUDE.md.

## Process when asked to organize / suggest structure
1. Recall CLAUDE.md layout rules.
2. Analyze the feature (extraction, calendar sync, dashboard, etc.).
3. Propose minimal structure: prefer colocation → route groups → global only if shared.
4. Show tree diff / proposed folders.
5. Explain trade-offs (colocation = less imports, global = easier reuse).
6. Ask "create these folders/files?" before acting.

Examples:
- New contract upload → app/contracts/upload/page.tsx + colocate uploader component
- Shared calendar helper → lib/google-calendar.ts