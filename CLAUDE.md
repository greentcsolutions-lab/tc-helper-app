# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
