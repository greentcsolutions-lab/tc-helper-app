# Project Structure

Last updated: 2026-01-23

```
.
├── .claude
│   ├── skills
│   │   ├── clean-code-guardian
│   │   │   └── SKILL.md
│   │   ├── commit-orchestrator
│   │   │   └── SKILL.md
│   │   ├── dead-code-cleanup
│   │   │   └── SKILL.md
│   │   ├── debug-tracer
│   │   │   └── SKLL.md
│   │   ├── dependency-guardian
│   │   │   └── SKILL.md
│   │   ├── error-recovery
│   │   │   └── SKILL.md
│   │   ├── frontend-design
│   │   │   └── SKILL.md
│   │   ├── package-scout
│   │   │   └── SKILL.md
│   │   ├── project-architect
│   │   │   └── SKILL.md
│   │   ├── prompt-classifier
│   │   │   └── SKILL.md
│   │   ├── scalability-strategist
│   │   │   └── SKILL.md
│   │   ├── scripts
│   │   │   └── check-deps.ts
│   │   ├── security-overseer
│   │   │   └── SKILL.md
│   │   ├── test-writer
│   │   │   └── SKILL.md
│   │   ├── update-tree-md
│   │   │   └── SKILL.md
│   │   └── verification-guardian
│   │       └── SKILL.md
│   └── settings.local.json
├── docs
│   └── GOOGLE_CALENDAR_SETUP.md
├── prisma
│   ├── migrations
│   │   ├── 20251127015958_add_counter_info_to_parse
│   │   │   └── migration.sql
│   │   ├── 20251129180320_add_self_destruct_fields
│   │   │   └── migration.sql
│   │   ├── 20251129183609_add_final_self_destruct_fields
│   │   │   └── migration.sql
│   │   ├── 20251223113706_add_phase1_dual_dpi_storage
│   │   │   └── migration.sql
│   │   ├── 20260104145554_add_tasks_system
│   │   │   └── migration.sql
│   │   ├── 20260104150833_add_tasks_system
│   │   │   └── migration.sql
│   │   ├── 20260109122422_add_basic_plan_support
│   │   │   └── migration.sql
│   │   ├── 20260109195102_add_onboarding_fields
│   │   │   └── migration.sql
│   │   ├── 20260109201914_add_progressive_onboarding_tracking
│   │   │   └── migration.sql
│   │   ├── 20260109220600_change_task_type_to_array
│   │   │   └── migration.sql
│   │   ├── 20260110142730_add_google_calendar_sync
│   │   │   └── migration.sql
│   │   ├── 20260110153615_add_is_default_for_new_files
│   │   │   └── migration.sql
│   │   ├── 20260115150504_add_timeline_data_structured
│   │   │   └── migration.sql
│   │   ├── 20260115183900_add_is_ai_generated_to_templates
│   │   │   └── migration.sql
│   │   ├── 20260116120000_add_google_calendar_integration
│   │   │   └── migration.sql
│   │   ├── 20260116200000_add_timeline_event_key
│   │   │   └── migration.sql
│   │   ├── 20260117213743_add_is_ai_generated_to_tasks
│   │   │   └── migration.sql
│   │   ├── 20260120172840_add_calendar_sync_memory
│   │   │   └── migration.sql
│   │   ├── migration_lock.toml
│   │   └── migration.sql
│   └── schema.prisma
├── public
│   ├── fonts
│   │   ├── InterVariable-Italic.woff2
│   │   └── InterVariable.woff2
│   ├── dashboard.png
│   ├── file.svg
│   ├── globe.svg
│   ├── mess-contract-extraction.jpg
│   ├── mess-contract-extraction.png
│   ├── next.svg
│   ├── tc-helper-transactions-page.jpg
│   ├── tc-helper-transactions-page.png
│   ├── vercel.svg
│   └── window.svg
├── scripts
│   └── migrate-safe.sh
├── src
│   ├── app
│   │   ├── about
│   │   │   └── page.tsx
│   │   ├── api
│   │   │   ├── address
│   │   │   │   └── autosuggest
│   │   │   │       └── route.ts
│   │   │   ├── credits
│   │   │   │   └── route.ts
│   │   │   ├── cron
│   │   │   │   ├── cleanup-stale-temp-data
│   │   │   │   │   └── route.ts
│   │   │   │   ├── renew-calendar-webhooks
│   │   │   │   │   └── route.ts
│   │   │   │   └── renew-webhooks
│   │   │   ├── debug
│   │   │   │   └── whop-config
│   │   │   │       └── route.ts
│   │   │   ├── google-calendar
│   │   │   │   ├── callback
│   │   │   │   │   └── route.ts
│   │   │   │   ├── cleanup-duplicates
│   │   │   │   │   └── route.ts
│   │   │   │   ├── connect
│   │   │   │   │   └── route.ts
│   │   │   │   ├── debug-sync
│   │   │   │   │   └── route.ts
│   │   │   │   ├── disconnect
│   │   │   │   │   └── route.ts
│   │   │   │   ├── poll-sync
│   │   │   │   │   └── route.ts
│   │   │   │   ├── settings
│   │   │   │   │   └── route.ts
│   │   │   │   ├── sync
│   │   │   │   │   └── route.ts
│   │   │   │   └── webhook
│   │   │   │       └── route.ts
│   │   │   ├── parse
│   │   │   │   ├── archive
│   │   │   │   │   └── route.ts
│   │   │   │   ├── bulk-delete
│   │   │   │   │   └── route.ts
│   │   │   │   ├── classify
│   │   │   │   │   └── [parseId]
│   │   │   │   │       └── route.ts
│   │   │   │   ├── cleanup
│   │   │   │   │   └── [parseId]
│   │   │   │   │       └── route.ts
│   │   │   │   ├── delete
│   │   │   │   │   └── [parseId]
│   │   │   │   │       └── route.ts
│   │   │   │   ├── extract
│   │   │   │   │   └── [parseId]
│   │   │   │   │       └── route.ts
│   │   │   │   ├── finalize
│   │   │   │   │   └── [parseId]
│   │   │   │   │       └── route.ts
│   │   │   │   ├── preview
│   │   │   │   │   └── [parseId]
│   │   │   │   │       └── route.ts
│   │   │   │   └── upload
│   │   │   │       └── route.ts
│   │   │   ├── progressive-onboarding
│   │   │   │   ├── check
│   │   │   │   │   └── route.ts
│   │   │   │   ├── dismiss
│   │   │   │   │   └── route.ts
│   │   │   │   └── save
│   │   │   │       └── route.ts
│   │   │   ├── save-user-state
│   │   │   │   └── route.ts
│   │   │   ├── settings
│   │   │   │   ├── ai-template
│   │   │   │   │   ├── reset
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   ├── plan-info
│   │   │   │   │   └── route.ts
│   │   │   │   ├── profile
│   │   │   │   │   └── route.ts
│   │   │   │   └── templates
│   │   │   │       ├── [id]
│   │   │   │       │   └── route.ts
│   │   │   │       └── route.ts
│   │   │   ├── subscriptions
│   │   │   │   ├── buy-credits
│   │   │   │   │   └── route.ts
│   │   │   │   └── checkout
│   │   │   │       └── route.ts
│   │   │   ├── tasks
│   │   │   │   ├── bulk-delete
│   │   │   │   │   └── route.ts
│   │   │   │   ├── [id]
│   │   │   │   │   └── route.ts
│   │   │   │   ├── sync
│   │   │   │   │   └── route.ts
│   │   │   │   ├── timeline
│   │   │   │   │   └── [parseId]
│   │   │   │   │       └── route.ts
│   │   │   │   ├── timeline-update
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── teams
│   │   │   │   ├── [teamId]
│   │   │   │   │   ├── members
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── transactions
│   │   │   │   ├── create-manual
│   │   │   │   │   └── route.ts
│   │   │   │   └── update
│   │   │   │       └── [id]
│   │   │   │           └── route.ts
│   │   │   └── webhooks
│   │   │       └── whop
│   │   │           └── route.ts
│   │   ├── dashboard
│   │   │   ├── billing
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── onboarding
│   │   │   ├── components
│   │   │   ├── page.tsx
│   │   │   └── types.ts
│   │   ├── plans
│   │   │   └── page.tsx
│   │   ├── privacy
│   │   │   └── page.tsx
│   │   ├── settings
│   │   │   └── page.tsx
│   │   ├── tasks
│   │   │   └── page.tsx
│   │   ├── teams
│   │   │   ├── members
│   │   │   │   └── page.tsx
│   │   │   ├── settings
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── terms
│   │   │   └── page.tsx
│   │   ├── timeline
│   │   │   ├── calendar.css
│   │   │   ├── page.tsx
│   │   │   └── TimelineClient.tsx
│   │   ├── transactions
│   │   │   └── page.tsx
│   │   ├── upload
│   │   │   ├── manual
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── billing
│   │   │   └── BillingActions.tsx
│   │   ├── dashboard
│   │   │   ├── NextClosingCard.tsx
│   │   │   ├── NextDueCard.tsx
│   │   │   └── NextTaskCard.tsx
│   │   ├── layout
│   │   │   ├── ModernHeader.tsx
│   │   │   ├── ModernSidebar.tsx
│   │   │   ├── SiteFooter.tsx
│   │   │   ├── TestingBanner.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── settings
│   │   │   ├── AIGeneratedTasksSettings.tsx
│   │   │   ├── BillingSettings.tsx
│   │   │   ├── CalendarSyncSettings.tsx
│   │   │   ├── CreateTemplateDialog.tsx
│   │   │   ├── PreferencesSettings.tsx
│   │   │   ├── ProfileSettings.tsx
│   │   │   ├── TaskTemplatesSettings.tsx
│   │   │   └── TeamSettings.tsx
│   │   ├── tasks
│   │   │   ├── AddFromTemplateDialog.tsx
│   │   │   ├── NewTaskDialog.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskOverview.tsx
│   │   │   ├── TasksClient.tsx
│   │   │   └── TasksTable.tsx
│   │   ├── teams
│   │   │   ├── index.ts
│   │   │   ├── MemberList.tsx
│   │   │   ├── TaskAssignment.tsx
│   │   │   ├── TeamSettingsPlaceholder.tsx
│   │   │   └── TeamsPlaceholder.tsx
│   │   ├── transactions
│   │   │   ├── ActionBar.tsx
│   │   │   ├── TransactionsClient.tsx
│   │   │   └── TransactionTable.tsx
│   │   ├── ui
│   │   │   ├── upload
│   │   │   │   ├── dropzone.tsx
│   │   │   │   ├── preview-gallery.tsx
│   │   │   │   ├── processing-view.tsx
│   │   │   │   ├── results-view.tsx
│   │   │   │   ├── types.ts
│   │   │   │   └── upload-zone.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── CopyAllButton.tsx
│   │   │   ├── CopyFieldRow.tsx
│   │   │   ├── CreditsBadge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toggle-group.tsx
│   │   │   ├── toggle.tsx
│   │   │   └── TopLoader.tsx
│   │   ├── wizard
│   │   │   ├── steps
│   │   │   │   ├── AcceptanceDateStep.tsx
│   │   │   │   ├── BuyerNamesStep.tsx
│   │   │   │   ├── BuyersAgentStep.tsx
│   │   │   │   ├── ListingAgentStep.tsx
│   │   │   │   ├── PropertyAddressStep.tsx
│   │   │   │   ├── ReviewStep.tsx
│   │   │   │   ├── SellerNamesStep.tsx
│   │   │   │   ├── TimelineDatesStep.tsx
│   │   │   │   └── TransactionTypeStep.tsx
│   │   │   └── ManualTransactionWizard.tsx
│   │   ├── CategoryPurchaseTerms.tsx
│   │   ├── CategoryRepresentingParties.tsx
│   │   ├── CategorySection.tsx
│   │   ├── CategoryTimelineContingencies.tsx
│   │   ├── CategoryTransactionInfo.tsx
│   │   ├── ExtractionCategories.tsx
│   │   ├── HeroMockupDisplay.tsx
│   │   └── ProgressiveOnboardingModal.tsx
│   ├── forms
│   │   ├── california
│   │   │   ├── extractor.schema.json
│   │   │   └── schema.json
│   │   ├── universal
│   │   │   └── extractor.schema.json
│   │   └── classifier.schema.json
│   ├── hooks
│   │   ├── useCleanupEffects.ts
│   │   ├── useFileUpload.ts
│   │   └── useParseOrchestrator.ts
│   ├── lib
│   │   ├── address
│   │   │   └── state-utils.ts
│   │   ├── dates
│   │   │   ├── extract-timeline-events.ts
│   │   │   └── timezone-utils.ts
│   │   ├── debug
│   │   │   └── parse-logger.ts
│   │   ├── email
│   │   │   ├── client.ts
│   │   │   └── send-welcome-email.ts
│   │   ├── extraction
│   │   │   ├── classify
│   │   │   │   ├── markdown-classifier.ts
│   │   │   │   └── post-processor.ts
│   │   │   ├── Claude
│   │   │   │   └── extractPdf.ts
│   │   │   ├── extract
│   │   │   │   └── universal
│   │   │   │   │       └── helpers
│   │   │   │   │           └── date-utils.ts
│   │   │   ├── gemini
│   │   │   │   └── extractPdf.ts
│   │   │   ├── grok
│   │   │   │   └── textClassify.ts
│   │   │   ├── mistral
│   │   │   │   └── classifyPdf.ts
│   │   │   └── shared
│   │   │       ├── ai-race.ts
│   │   │       ├── extraction-schema.ts
│   │   │       ├── extract-json.ts
│   │   │       └── transform-to-universal.ts
│   │   ├── google-calendar
│   │   │   ├── ai-inference.ts
│   │   │   ├── calendar-init.ts
│   │   │   ├── calendar-to-app.ts
│   │   │   ├── client.ts
│   │   │   ├── property-matcher.ts
│   │   │   ├── run-simulation.ts
│   │   │   ├── sync-timeline-events.ts
│   │   │   ├── sync.ts
│   │   │   ├── title-utils.ts
│   │   │   └── webhook.ts
│   │   ├── grok
│   │   │   └── type-coercion.ts
│   │   ├── parse
│   │   │   └── map-to-parse-result.ts
│   │   ├── tasks
│   │   │   └── sync-timeline-tasks.ts
│   │   ├── timeline
│   │   │   └── timeline-formatter.ts
│   │   ├── date-utils.ts
│   │   ├── prisma.ts
│   │   ├── utils.ts
│   │   └── whop.ts
│   ├── types
│   │   ├── calendar.ts
│   │   ├── classification.ts
│   │   ├── extraction.ts
│   │   ├── index.ts
│   │   ├── manual-wizard.ts
│   │   ├── parse-result.ts
│   │   ├── pdfjs-decl.d.ts
│   │   ├── pdf-page-counter.d.ts
│   │   ├── prisma.d.ts
│   │   ├── task.ts
│   │   └── timeline.ts
│   └── middleware.ts
├── .vscode
│   └── settings.json
├── ChangeLog.md
├── .claude-branch
├── CLAUDE.md
├── components.json
├── .env
├── .env.example
├── .env.local
├── eslint.config.mjs
├── GEMINI.md
├── .gitignore
├── GOOGLE_CALENDAR_SYNC_FIXES.md
├── next.config.js
├── package.json
├── package-lock.json
├── postcss.config.js
├── README.md
├── SYNC_STATUS.md
├── tailwind.config.js
├── task_summary.md
├── temp-tree.txt
├── TREE.md
├── tsconfig.json
├── vercel.json
├── WEBHOOK_FIX_REQUIRED.md
└── WHOP_INTEGRATION_SETUP.md

167 directories, 280 files
```
