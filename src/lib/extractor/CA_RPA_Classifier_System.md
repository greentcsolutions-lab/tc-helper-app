# California RPA Classification System
## Version 3.0.0 - Footer-Based Form Matching

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PROCESS ROUTE                            │
│  /api/parse/process/[parseId]                                   │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─► 1. pdf-lib → Get exact pageCount
             │
             ├─► 2. Nutrient → Render ALL pages @ 100 DPI
             │
             ├─► 3. Download ZIP → Extract PNGs
             │
             ├─► 4. CLASSIFICATION (NEW SYSTEM)
             │   │
             │   └─► classifier.ts
             │       ├─► Tag each PNG: "━━━ Image 7/40 ━━━"
             │       ├─► Parallel batches (6 pages each)
             │       ├─► Use form-definitions.ts (footer patterns)
             │       ├─► Use buildClassifierPrompt(pageCount)
             │       └─► Return: {
             │             rpa_pages: { page_1_at_pdf_page: 7, ... },
             │             counter_offer_pages: [1, 38, 39],
             │             addendum_pages: [40]
             │           }
             │
             ├─► 5. Flatten & Validate
             │   │
             │   └─► [7, 8, 9, 22, 23, 1, 38, 39, 40]
             │       ├─► Deduplicate
             │       ├─► Filter (page > pageCount)
             │       └─► Sort: [1, 7, 8, 9, 22, 23, 38, 39, 40]
             │
             ├─► 6. Nutrient → Render ONLY critical pages @ 290 DPI
             │
             └─► 7. Grok Extraction → Final JSON
```

---

## Key Components

### 1. **form-definitions.ts** (NEW)
Modular configuration for all CA forms:
- `RPA_FORM`: Footer pattern + required internal pages (1, 2, 3, 16, 17)
- `COUNTER_OFFERS`: SCO, BCO, SMCO patterns (capture ALL pages)
- `KEY_ADDENDA`: ADM, TOA, AEA patterns (single-page forms)

### 2. **prompts.ts** (UPDATED)
Dynamic prompt generation:
- `buildClassifierPrompt(totalPages)` - Footer-focused instructions
- Clear examples with exact patterns
- Structured JSON schema for responses

### 3. **classifier.ts** (REWRITTEN)
Form-specific footer matching:
- Tags each PNG with page number for Grok context
- Parallel batches (6 pages) for speed
- Validates page numbers (≤ pageCount)
- Detailed logging with form context
- Returns deduplicated array

### 4. **process/[parseId]/route.ts** (UPDATED)
Orchestrates the pipeline:
- Passes `pageCount` to classifier
- Uses returned page array for second render

---

## Example Console Output

```
[process:abc123] PDF loaded - 40 pages detected
[Nutrient] Complete: first 40 pages (exact) @ 100 DPI → renders/xxx.zip
[classifier] Starting PARALLEL classification: 40 pages → 7 batches of ~6

[classifier:batch1] Processing pages 1–6
[classifier:batch2] Processing pages 7–12
[classifier:batch3] Processing pages 13–18
[classifier:batch4] Processing pages 19–24
[classifier:batch5] Processing pages 25–30
[classifier:batch6] Processing pages 31–36
[classifier:batch7] Processing pages 37–40

[classifier:batch1] ✓ Pages 1–6 classified
[classifier:batch2] ✓ Pages 7–12 classified
...
[classifier] ✓ All batches complete in 3.5s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[classifier] 📋 CLASSIFICATION RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RPA (Main Contract):
  ✓ RPA Page 1 → PDF Page 7
  ✓ RPA Page 2 → PDF Page 8
  ✓ RPA Page 3 → PDF Page 9
  ✓ RPA Page 16 → PDF Page 22
  ✓ RPA Page 17 → PDF Page 23

Counter Offers (2 pages):
  → PDF Pages: [1, 38]

Addenda (1 pages):
  → PDF Pages: [40]

📊 SUMMARY:
   Total pages analyzed: 40
   Critical pages found: 8
   Page numbers: [1, 7, 8, 9, 22, 23, 38, 40]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Nutrient] Render config: pages [1, 7, 8, 9, 22, 23, 38, 40] @ 290 DPI
```

---

## What Gets Fixed

### Before (Broken):
- ❌ Page 45 returned (doc only has 40 pages) → Nutrient 400 error
- ❌ Pages 31, 38 identified as "critical" (random middle pages)
- ❌ Counter offer on page 1 completely missed
- ❌ RPA start pages not identified
- ❌ Duplicates: `[31, 31, 31, 31, 38, 38, 38, 45]`

### After (Fixed):
- ✅ Page numbers validated (≤ pageCount)
- ✅ Footer-based matching (exact patterns)
- ✅ Counter offers detected (page 1)
- ✅ RPA pages 1-3, 16-17 found correctly
- ✅ Deduplicated: `[1, 7, 8, 9, 22, 23, 38, 40]`
- ✅ Clear logging with form context

---

## Performance

**40-page document:**
- Classification: ~3-4s (7 parallel batches)
- Total pipeline: ~35-45s (well under 60s Hobby limit)

**Cost per doc:** ~$0.05-0.06 (Nutrient + Grok)
