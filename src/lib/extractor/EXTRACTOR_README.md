# California RPA Extraction System
**Version: 2.0.0 - 2025-01-09**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    /api/parse/process/[parseId]             │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─► 1. pdf-lib → Get exact pageCount
             │
             ├─► 2. Nutrient → Render ALL pages @ 120 DPI
             │   └─► CREDIT DEDUCTED HERE ✅
             │
             ├─► 3. classifier.ts (PARALLEL, 6 pages/batch)
             │   ├─► Tag PNGs: "━━━ Image 7/40 ━━━"
             │   ├─► Match footer patterns (form-definitions.ts)
             │   ├─► Validate sequential order (sequential-validator.ts)
             │   └─► Return: [11, 12, 13, 27, 28, 1, 38]
             │
             ├─► 4. pdf-lib → Extract critical pages to new PDF
             │
             ├─► 5. Nutrient → Render critical pages @ 200 DPI
             │
             ├─► 6. extractor.ts → Grok extraction
             │   ├─► Use field-locator.ts (5-column table coordinates)
             │   ├─► Detect handwriting-over-typed → REJECT
             │   ├─► Enforce confidence thresholds
             │   └─► Return: { extracted, confidence, handwriting_detected }
             │
             ├─► 7. counter-merger.ts → Merge counter offers
             │   ├─► Validate signatures on each counter
             │   ├─► Apply highest numbered counter
             │   ├─► Calculate final acceptance date
             │   └─► Return: { finalTerms, counterChain }
             │
             └─► 8. Save to database → Status: COMPLETED or NEEDS_REVIEW
```

---

## File Structure

```
src/lib/extractor/
├── classifier.ts                  # v3.0.0 - Sequential footer matching
├── extractor.ts                   # v2.0.0 - Context-aware extraction
├── prompts.ts                     # v2.0.0 - Dynamic prompt generation
├── form-definitions.ts            # v1.0.0 - CA form specifications
├── field-locator.ts               # v2.0.0 - 5-column table coordinates
├── counter-merger.ts              # v2.0.0 - Signature-aware merge logic
├── sequential-validator.ts        # v2.0.0 - RPA block validation
└── CA_RPA_Classifier_System.md    # Architecture docs
```

---

## Key Features

### 1. **Smart Sequential Classification**
- Validates RPA pages are in correct order (1-3, 16-17)
- Uses bottom LEFT footer (ignores center footer)
- Detects scattered pages with warnings
- Rejects documents missing required pages

### 2. **Context-Aware Extraction**
- Guides Grok through 5-column table structure
- Provides exact row/column coordinates for each field
- Enforces confidence thresholds (95%/85%/75%)
- Applies sensible defaults (17 days, Conventional loan, etc.)

### 3. **Counter Offer Merge Logic**
- Implements "highest number wins IF both signatures" rule
- Tracks counter chain: `RPA → SCO #1 → BCO #1`
- Merges fields correctly (counters only replace what they mention)
- Calculates final acceptance date based on document type

### 4. **Handwriting Rejection**
- Rejects docs with handwritten text OVER typed text
- Handwriting ALONGSIDE typed text is acceptable
- Returns clear error message for legal compliance

---

## Configuration

### Confidence Thresholds

Defined in `field-locator.ts`:

```typescript
CRITICAL_FIELDS (95%+):
- purchase_price
- property_address
- close_of_escrow
- final_acceptance_date
- contingency_days (loan/appraisal/investigation)

IMPORTANT_FIELDS (85%+):
- buyer_names
- all_cash
- initial_deposit
- loan_type
- cop_contingency

OPTIONAL_FIELDS (75%+):
- seller_credit_to_buyer
- home_warranty
- seller_delivery_days
- brokerage_info
```

### Default Values

```typescript
loan_type: "Conventional"  (if not all cash)
loan_contingency_days: 17  (unless waived)
appraisal_contingency_days: 17  (unless waived)
investigation_contingency_days: 17
seller_delivery_docs_days: 7
```

---

## Form Specifications

### RPA (Main Contract) - 17 Pages Total

**Required Pages for Extraction:**
- **Page 1**: Buyer names, property address, purchase price, all cash, close of escrow, initial deposit
- **Page 2**: Loan type, seller credit, contingencies (L1-L9), seller delivery (N1), COP (L9)
- **Page 3**: Home warranty (3.Q18)
- **Page 16**: Seller signatures with dates
- **Page 17**: Real estate brokers section

**Footer Pattern:** `"RPA REVISED 6/25 (PAGE X OF 17)"` - Bottom LEFT corner

### Counter Offers

| Form | Pages | Footer Pattern | Signatures |
|------|-------|---------------|------------|
| SCO (Seller Counter) | 2 | `(SCO PAGE X OF 2)` | Page 1: Seller, Page 2: Buyer |
| BCO (Buyer Counter) | 1 | `(BCO PAGE X OF 1)` | Page 1: Both |
| SMCO (Seller Multiple) | 2 | `(SMCO PAGE X OF 2)` | Page 1: Seller, Page 2: Buyer |

### Key Addenda (Single Page)

| Form | Footer Pattern | Purpose |
|------|---------------|---------|
| ADM | `(ADM PAGE 1 OF 1)` | General addendum with additional terms |
| TOA | `(TOA PAGE 1 OF 1)` | Text overflow when standard fields are full |
| AEA | `(AEA PAGE 1 OF 1)` | Amendment to existing agreement |

---

## 5-Column Table Structure (RPA Pages 1-3)

The RPA form uses a complex 5-column table for most fields. Understanding this structure is critical for accurate extraction.

### Table Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Section 3: PURCHASE PRICE AND TERMS                          │
├────────┬────────┬────────┬────────┬─────────────────────────┤
│ Col 1  │ Col 2  │ Col 3  │ Col 4  │ Col 5                   │
│ Label  │ Input  │ Check  │ Value  │ Date/Waiver             │
├────────┼────────┼────────┼────────┼─────────────────────────┤
│ 3.A    │        │        │ $1.2M  │ [x] All Cash            │
│ 3.B    │        │        │ 30 days│                         │
│ 3.D(1) │        │        │ $50,000│ 3 days                  │
│ 3.E(1) │        │        │        │ [x] Conventional        │
│ 3.G(1) │        │ [x]    │ $5,000 │                         │
├────────┴────────┴────────┴────────┴─────────────────────────┤
│ ... (continues for 2.5 pages)                                │
└──────────────────────────────────────────────────────────────┘
```

### Key Field Locations

**Page 1:**
- `3.A` (Purchase Price): Columns 2-4
- `3.A` (All Cash Checkbox): Column 5
- `3.B` (Close of Escrow): Column 4
- `3.D(1)` (Initial Deposit Amount): Column 4
- `3.D(1)` (Initial Deposit Due): Column 5

**Page 2:**
- `3.E(1)` (Loan Type): Column 5
- `3.G(1)` (Seller Credit): Checkbox Column 3, Amount Column 4
- `L(1)` (Loan Contingency): Days Column 4, Waiver Column 5
- `L(2)` (Appraisal Contingency): Days Column 4, Waiver Column 5
- `L(3)` (Investigation Contingency): Days Column 4
- `L(8)` (CR-B Attached): Checkbox Column 5
- `L(9)` (COP): Checkbox Columns 3+5 (combined cell)
- `N(1)` (Seller Delivery): Days Column 4

**Page 3:**
- `3.Q(18)` (Home Warranty): Who pays Columns 4+5, Max cost right side

---

## Counter Offer Merge Logic

### Rules

1. **Highest counter number wins** IF both buyer AND seller signatures present
2. **Counters only replace SPECIFIC fields** they mention
3. **Invalid counters** (missing signatures) are ignored
4. **Priority order**: BCO 3 > SCO 2 > BCO 2 > SCO 1 > RPA

### Example Scenario

**RPA:**
- Purchase Price: $1,200,000
- Close of Escrow: 30 days

**SCO #1:**
- Close of Escrow: 21 days
- (Buyer signs → acceptance date)

**BCO #1:**
- Purchase Price: $1,300,000
- Close of Escrow: 30 days
- (Seller signs → acceptance date)

**Final Terms:**
- Purchase Price: $1,300,000 (from BCO #1)
- Close of Escrow: 30 days (from BCO #1, overrides SCO #1)
- Final Acceptance: 12/05/2024 (Seller signature on BCO #1)
- Counter Chain: `RPA → SCO #1 → BCO #1`

---

## Acceptance Date Calculation

### Rule: Who signs LAST determines acceptance

- **Buyer-originated docs** (RPA, BCO) → **Seller signature = acceptance**
- **Seller-originated docs** (SCO, SMCO) → **Buyer signature = acceptance**

### Logic Flow

```typescript
1. Find highest numbered counter with BOTH signatures
2. If counter type is BCO → use Seller signature date
3. If counter type is SCO/SMCO → use Buyer signature date
4. If no valid counters → use RPA Seller signature date
```

---

## Timeline Calculation

### Standard Timeline (No COP)

All deadlines start from **final acceptance date**:
- Initial Deposit: Due in X days
- Loan Contingency: Remove in 17 days (default)
- Appraisal Contingency: Remove in 17 days (default)
- Investigation Contingency: Remove in 17 days (default)
- Seller Delivery: Within 7 days (default)
- Close of Escrow: 30 days (or specific date)

### COP Timeline (Contingency for Sale of Buyer's Property)

If COP checkbox is checked (Section L9):
- Timeline starts when **COP is removed**
- Bob accepts offer on his house Day 3 → triggers start of timeline
- All contingencies run from COP removal date, NOT acceptance date

---

## Error Handling

### Classification Errors

```typescript
✗ Missing RPA Page X → EXTRACTION_FAILED
⚠ RPA pages not sequential → Continue with warning
✗ Page number > totalPages → Filter out (hallucination)
```

### Extraction Errors

```typescript
✗ Handwriting over typed → REJECT immediately
✗ Critical field confidence < 95% → NEEDS_REVIEW
⚠ Important field confidence < 85% → Log warning
ℹ Optional field confidence < 75% → Accept anyway
```

### Counter Offer Errors

```typescript
✗ Missing seller signature → Ignore this counter
✗ Missing buyer signature → Ignore this counter
⚠ SCO has 1 page (expected 2) → Log warning, attempt extraction
```

---

## Performance Metrics

**40-Page Document:**
- Classification: ~3-4s (7 parallel batches)
- High-res render: ~5-6s (8 critical pages @ 200 DPI)
- Extraction: ~4-5s (Grok 4.1 reasoning)
- **Total: ~35-45s** (well under 60s Hobby limit)

**Cost per Document:**
- Nutrient (120 DPI + 200 DPI): ~$0.03
- Grok Classification: ~$0.01
- Grok Extraction: ~$0.02
- **Total: ~$0.06 per parse**

---

## Testing Commands

```bash
# Test classification only
npm run test:classify -- path/to/test.pdf

# Test full pipeline
npm run test:extract -- path/to/test.pdf

# Test counter merger logic
npm run test:counters -- path/to/multi-counter.pdf
```

---

## Common Issues & Solutions

### Issue: "Missing RPA Page 2"
**Cause:** Footer not detected or blurry
**Solution:** Check DPI setting (should be 120+), verify footer is readable

### Issue: "Non-sequential RPA pages"
**Cause:** Document has counters spliced between RPA pages
**Solution:** System continues extraction, but confidence may be lower

### Issue: "No handwriting detected but field blank"
**Cause:** Field is truly blank in original document
**Solution:** Check default values in field-locator.ts

### Issue: "Counter chain incorrect"
**Cause:** Missing signatures not detected
**Solution:** Verify counter pages include signature blocks in images

---

## Future Enhancements

1. **OCR fallback** for very low-quality PDFs
2. **Multi-state support** (Nevada, Arizona, Texas)
3. **Addendum text extraction** (beyond just detection)
4. **Confidence boosting** via ensemble models
5. **Real-time preview** of classification before extraction

---

## Support

For issues or questions:
- Check `VALIDATION_GUIDE.md` for testing procedures
- Review console logs for detailed classification results
- See `CA_RPA_Classifier_System.md` for architecture details

**Current Version:** 2.0.0 (2025-01-09)
**Accuracy Target:** 95%+ on critical fields, 85%+ on important fields