# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 MANDATORY WORKFLOW

**CRITICAL**: On EVERY user prompt, you MUST invoke the `prompt-classifier` skill FIRST before taking any action. This skill:
- Classifies user intent in <5 tokens (PLANNING, UI_DESIGN, IMPLEMENT, EDIT, DEBUG, DEPS, TEST, VERIFY, SECURITY, EXPLAIN, RESEARCH)
- Outputs the exact tool sequence to follow
- Prevents verbose reasoning loops and ensures consistency
- Maintains code quality through proper skill orchestration

**Example Flow:**
```
User prompt → invoke prompt-classifier → follow SEQUENCE → invoke skills as specified
```

The only exception is if the user explicitly says `/noclassify` or "skip classifier".

## Project Overview

TC Helper is a Next.js application for extracting structured data from real estate contract PDFs. It uses AI (Gemini preferred, Claude as fallback) for extraction and focuses on privacy-first processing where PDFs are deleted immediately after extraction.

## Development Commands

```bash
npm run dev          # Start dev server (runs db:push first)
npm run build        # Production build
npm run type-check   # TypeScript validation (tsc --noEmit)
npm run db:push      # Push Prisma schema to database
npm run db:studio    # Open Prisma Studio GUI
npm run db:migrate:create  # Create new migration
npm run db:migrate:deploy  # Deploy migrations
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Clerk (`@clerk/nextjs`)
- **UI**: Radix UI primitives, Tailwind CSS, shadcn/ui patterns
- **AI Extraction**: Gemini (primary), Claude (fallback) via `src/lib/extraction/shared/ai-race.ts`
- **Storage**: Vercel Blob
- **Subscriptions**: Whop integration

## Architecture

### Path Aliases
```
@/*     → ./src/*
@lib/*  → ./src/lib/*
```

### Key Directories

- `src/app/` - Next.js App Router pages and API routes
- `src/lib/` - Core business logic
  - `extraction/` - AI extraction logic with provider-specific implementations
    - `shared/ai-race.ts` - Races AI providers, prefers Gemini with 5s timeout
    - `gemini/`, `Claude/`, `mistral/` - Provider implementations
  - `google-calendar/` - Calendar sync logic (bidirectional sync, webhooks)
  - `dates/` - Date utilities for real estate timelines
- `src/components/` - React components
  - `ui/` - Base UI components (shadcn/ui pattern)
- `src/types/` - TypeScript type definitions
- `prisma/` - Database schema and migrations

### Core Data Models (Prisma)

- **User** - User profile, plan/subscription, usage quotas
- **Parse** - PDF extraction results with structured contract data
- **Task** - Transaction-related tasks with calendar sync support
- **Team/TeamMember** - Team collaboration support
- **CalendarSettings/CalendarEvent** - Google Calendar integration

### Authentication Flow

Middleware (`src/middleware.ts`) uses Clerk. Public routes include `/`, `/sign-in`, `/sign-up`, `/api`, `/privacy`, `/plans`, `/about`, `/terms`. Logged-in users on `/` redirect to `/dashboard`.

### PDF Extraction Flow

1. Upload PDF → stored in Vercel Blob
2. AI race selects fastest provider (Gemini preferred)
3. Extract structured data via `extractWithFastestAI()`
4. PDF deleted immediately after extraction
5. Only extracted JSON retained in database

## Environment Variables

Required (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` - Clerk auth
- `GEMINI_API_KEY` - Primary AI extraction
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Calendar integration

## Build Configuration

- `next.config.js` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` for faster builds
- Use `npm run type-check` explicitly for TypeScript validation
- Server runtime requires `poppler-utils` (pdftoppm) for PDF preview generation

## Custom Skills & Workflows

This project uses specialized Claude Code skills located in `.claude/skills/`. These skills are orchestrated by the prompt-classifier and enforce consistent patterns.

### Core Skills (Invoked via prompt-classifier)

#### 1. prompt-classifier (MANDATORY FIRST STEP)
- **Purpose**: Fast intent router & tool sequencer
- **Invocation**: Automatically on EVERY prompt (unless user says `/noclassify`)
- **Output**: Classification + exact tool/skill sequence
- **Priority**: Highest
- **Location**: `.claude/skills/prompt-classifier/`

#### 2. project-architect
- **Purpose**: Structure decisions for Next.js App Router projects
- **Triggers**: PLANNING/IMPLEMENT sequences via "plan-structure"
- **Focus**: Minimal, colocated organization; outputs tree diffs with rationale
- **Rules**:
  - Prefer colocation > route groups > global utils
  - Colocate components/hooks in route folders
  - Use `lib/` only for shared utilities (reuse >2 places)
  - `app/api/` for API routes
- **Location**: `.claude/skills/project-architect/`

#### 3. dependency-guardian
- **Purpose**: Protects existing dependencies, checks compatibility
- **Triggers**: DEPS classification, package add/install requests
- **Approach**: Extremely conservative - prioritize zero breakage
- **Checks**: Peer deps, conflicts, security, bundle size, runtime compatibility, TypeScript support
- **Output**: Structured report + risk level + approval gate
- **Location**: `.claude/skills/dependency-guardian/`

#### 4. frontend-design
- **Purpose**: Creates distinctive, production-grade UI components
- **Triggers**: UI_DESIGN classification, component/page creation with design focus
- **Principles**:
  - Bold aesthetic direction (avoid generic AI aesthetics)
  - Distinctive typography (no Inter, Roboto, Arial defaults)
  - Cohesive color themes with CSS variables
  - Animations & micro-interactions (CSS-first, Motion library for React)
  - Unexpected layouts, asymmetry, generous negative space
  - Contextual backgrounds (gradients, textures, patterns, not solid colors)
- **Anti-patterns**: Purple gradients on white, predictable layouts, cookie-cutter designs
- **Location**: `.claude/skills/frontend-design/`

#### 5. verification-guardian
- **Purpose**: Automated quality & behavior checks after code changes
- **Triggers**: After write/edit in IMPLEMENT/EDIT sequences
- **Checks** (scoped to changed files for performance):
  - TypeScript: `tsc --noEmit` (scoped)
  - Lint: `eslint --fix` (scoped)
  - Tests: scoped test runs
  - Domain assertions: Zod validation, timezone checks, secret leaks, API response format
- **Output**: Terse report + proposed fixes + approval gate
- **Performance**: Optimized for low-resource machines (scoped checks only)
- **Location**: `.claude/skills/verification-guardian/`

#### 6. commit-orchestrator
- **Purpose**: Safe git branching, conventional commits, push flow
- **Triggers**: Final step after verification-guardian passes
- **Safety Rules** (HARD ENFORCED):
  - NEVER commit to main/master/production
  - Always use feature branches: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`
  - Crash-resilient via `.claude-branch` marker file
  - Conventional commit messages (feat:, fix:, refactor:, chore:, etc.)
  - Never force-push without approval
- **Branch Naming**: `<type>/<short-slug>` (e.g., `feat/add-extract-endpoint`)
- **Location**: `.claude/skills/commit-orchestrator/`

### Supporting Skills

#### 7. test-writer
- **Purpose**: Generates/augments tests for code
- **Location**: `.claude/skills/test-writer/`

#### 8. security-overseer
- **Purpose**: Reviews code for security vulnerabilities (auth, validation, OWASP)
- **Location**: `.claude/skills/security-overseer/`

#### 9. clean-code-guardian
- **Purpose**: Reviews code for TypeScript patterns, readability
- **Location**: `.claude/skills/clean-code-guardian/`

#### 10. dead-code-cleanup
- **Purpose**: Identifies and removes unused code
- **Location**: `.claude/skills/dead-code-cleanup/`

#### 11. scalability-strategist
- **Purpose**: Analyzes scaling concerns and proposes solutions
- **Location**: `.claude/skills/scalability-strategist/`

#### 12. package-scout
- **Purpose**: Researches and recommends packages for specific needs
- **Location**: `.claude/skills/package-scout/`

### Workflow Examples

#### Example 1: Adding a New Feature
```
User: "add new PDF extract endpoint with Zod validation"

1. invoke prompt-classifier
   → CLASS: IMPLEMENT
   → SEQUENCE:
     1. plan-structure (project-architect)
     2. read-context app/api/extract
     3. clean-code-guardian "review proposed route plan"
     4. security-overseer "review for auth & validation"
     5. write app/api/extract/route.ts
     6. test-writer "generate tests for new route"
     7. verification-guardian
     8. commit-orchestrator
     9. ask-approval
```

#### Example 2: Designing UI Components
```
User: "create a beautiful transaction card component"

1. invoke prompt-classifier
   → CLASS: UI_DESIGN
   → SEQUENCE:
     1. plan-structure
     2. frontend-design "distinctive transaction card with bold aesthetic"
     3. clean-code-guardian "review TS patterns"
     4. write components/TransactionCard.tsx
     5. verification-guardian
     6. commit-orchestrator
```

#### Example 3: Adding Dependencies
```
User: "is it safe to add tanstack/react-query?"

1. invoke prompt-classifier
   → CLASS: DEPS
   → SEQUENCE:
     1. read "package.json"
     2. dependency-guardian "check-compat tanstack/react-query"
     3. ask-approval "Proceed with install?"
     4. shell "npm install tanstack/react-query" (if approved)
     5. verification-guardian
     6. commit-orchestrator
```

### Skill Integration Rules

1. **Always start with prompt-classifier** - No exceptions (unless `/noclassify`)
2. **Follow the SEQUENCE exactly** - Don't skip steps or reorder
3. **Wait for approval gates** - Skills will ask for approval at critical points
4. **Trust the skill outputs** - Skills are tuned for this project's patterns
5. **Scope checks for performance** - verification-guardian uses scoped checks
6. **Never commit to main** - commit-orchestrator enforces feature branches
7. **Conventional commits only** - commit-orchestrator formats messages

### Performance Considerations

- **Low-resource optimization**: Skills are designed for 4GB+ machines (e.g., Chromebooks)
- **Scoped verification**: Only check changed files + dependents
- **Build skipping**: Full `next build` may be skipped if low-resource detected
- **Fallback modes**: Skills will ask for approval before expensive operations

## TODOs & Known Issues

### Database Schema

- **TODO**: Investigate the usage of the `credits` field in the User model (schema.prisma:34)
  - Currently using `parseLimit` for monthly AI parse resets
  - Need to clarify the distinction between `credits` and `parseLimit`
  - May be related to one-time credit purchases vs subscription limits
