# File Versions & Changelog

## All Files with Version Numbers

### Core Layout Files
```
src/app/layout.tsx                          v2.0.0 - Added TopLoader
src/components/layout/ModernSidebar.tsx     v1.1.0 - Added Timeline nav
src/components/layout/ModernHeader.tsx      v1.0.0 - Initial version
src/components/layout/ThemeToggle.tsx       v1.0.0 - Initial version
```

### Dashboard Files
```
src/app/dashboard/page.tsx                  v2.0.0 - Reorganized for workflow
src/components/dashboard/NextDueCard.tsx    v1.0.0 - New component
```

### Timeline Feature Files
```
src/app/timeline/page.tsx                   v1.0.0 - New page
src/app/timeline/TimelineClient.tsx         v1.0.0 - New component
src/app/timeline/calendar.css               v1.0.0 - New styles
src/lib/dates/extract-timeline-events.ts    v1.0.0 - Date extraction utility
```

### Loading Bar
```
src/components/ui/TopLoader.tsx             v1.0.0 - New component
```

### Other Pages
```
src/app/page.tsx                            v1.0.0 - Homepage (no duplicate headers)
src/app/upload/page.tsx                     v1.0.0 - Clean layout
```

---

## Version History

### v2.0.0 Changes (Current Release)
**Dashboard Reorganization:**
- Moved Next Due to top priority
- Moved stats to bottom (reference only)
- Renamed "Past Parses" to "Transactions"
- Consolidated stats into single horizontal card

**Loading Bar Addition:**
- Added TopLoader component
- Integrated into root layout
- Automatic on all route transitions

**Timeline Feature:**
- Added complete calendar system
- Added date extraction utility
- Added Next Due dashboard widget
- Added Timeline nav item to sidebar

### v1.1.0 Changes
**ModernSidebar:**
- Added Calendar icon import
- Added Timeline navigation item

### v1.0.0 Changes (Initial Modern UI)
**Complete UI Overhaul:**
- Created ModernSidebar with collapse functionality
- Created ModernHeader with global actions
- Reorganized all pages for consistency
- Added dark mode support throughout
- Removed duplicate headers

---

## Tracking Future Changes

When you make changes, update the version number and add a comment:

```typescript
// src/app/dashboard/page.tsx
// Version: 2.1.0 - Added new feature X
```

### Version Number Guidelines:
- **Major (X.0.0)**: Breaking changes, complete rewrites
- **Minor (0.X.0)**: New features, significant changes
- **Patch (0.0.X)**: Bug fixes, minor tweaks

Example:
```
v1.0.0 → v1.1.0  (added feature)
v1.1.0 → v1.1.1  (fixed bug)
v1.1.1 → v2.0.0  (major rewrite)
```

---

## Files Modified This Session

```
Created (12 files):
├── src/components/layout/ModernSidebar.tsx      v1.1.0
├── src/components/layout/ModernHeader.tsx       v1.0.0
├── src/components/layout/ThemeToggle.tsx        v1.0.0
├── src/components/ui/TopLoader.tsx              v1.0.0
├── src/components/dashboard/NextDueCard.tsx     v1.0.0
├── src/app/timeline/page.tsx                    v1.0.0
├── src/app/timeline/TimelineClient.tsx          v1.0.0
├── src/app/timeline/calendar.css                v1.0.0
├── src/lib/dates/extract-timeline-events.ts     v1.0.0
└── (Plus homepage, upload, dashboard updates)

Updated (3 files):
├── src/app/layout.tsx                           v1.0.0 → v2.0.0
├── src/app/dashboard/page.tsx                   v1.0.0 → v2.0.0
└── src/components/layout/ModernSidebar.tsx      v1.0.0 → v1.1.0
```

---

## Quick Reference: Current State

Your app now has:
✅ Modern collapsible sidebar
✅ Clean top header
✅ Workflow-first dashboard
✅ Timeline calendar system
✅ Loading bar on navigation
✅ Next Due dashboard widget
✅ Consistent styling throughout
✅ Dark mode support
✅ Mobile responsive
✅ All files versioned
