# TC Helper App - Validation Guide
**Version: 2.0.0 - 2025-01-09**

## What Changed in This Update

### 1. **Smart Sequential Classifier** (classifier.ts v3.0.0)
- ✅ Validates RPA pages are in correct order (1-3, then 16-17)
- ✅ Catches footer edge cases (two footers per page, uses bottom LEFT)
- ✅ Logs detailed warnings if pages scattered
- ✅ Rejects documents missing required RPA pages

### 2. **Context-Aware Extractor** (extractor.ts v2.0.0)
- ✅ Guided through 5-column table with exact row/column coordinates
- ✅ Rejects documents with handwritten-over-typed text
- ✅ Uses field-specific confidence thresholds (95% for critical, 85% for important, 75% for optional)
- ✅ Applies default values (17 days contingencies, 7 days seller delivery, "Conventional" loan)

### 3. **Counter Offer Merger** (counter-merger.ts v2.0.0)
- ✅ Implements "highest number wins IF both signatures" rule
- ✅ Merges fields correctly (counters only replace what they mention)
- ✅ Calculates final acceptance date based on document type
- ✅ Tracks counter chain for audit trail

### 4. **Field Location Metadata** (field-locator.ts v2.0.0)
- ✅ Documents exact location of every field (page, section, columns)
- ✅ Groups fields by confidence requirement (CRITICAL/IMPORTANT/OPTIONAL)
- ✅ Provides descriptions for Grok context

### 5. **Updated Schema** (schema.json v2.0.0)
- ✅ Matches CategorySection components exactly
- ✅ Includes COP contingency tracking
- ✅ Supports counter chain and merge logic
- ✅ All required fields clearly marked

---

## Testing Checklist

### Test Document #1: Your 40-Page Sample
**Expected Results:**
```
RPA Page 1 → PDF Page 11 ✓
RPA Page 2 → PDF Page 12 ✓
RPA Page 3 → PDF Page 13 ✓
RPA Page 16 → PDF Page 27 ✓
RPA Page 17 → PDF Page 28 ✓

Counter Offers: [page numbers where SCO/BCO/SMCO found]
Addenda: [page numbers where ADM/TOA/AEA found]
```

**What to check:**
1. Console logs show "✓ Pages 1-3 are consecutive"
2. Console logs show "✓ Pages 16-17 are consecutive"
3. No page numbers > 40 in critical page array
4. All required RPA pages found

### Test Document #2: Scattered RPA (If You Have One)
**Expected Results:**
- Warning: "⚠ RPA pages not sequential"
- Still completes extraction
- Logs show which pages are out of order

### Test Document #3: Multiple Counters
**Expected Results:**
```
Counter chain: RPA → SCO #1 → BCO #1 → SCO #2
Final acceptance date: [date from highest counter]
Final terms: [merged fields from all counters]
```

**What to check:**
1. Confidence for purchase_price, property_address, close_of_escrow, final_acceptance_date all > 95%
2. Counter merge log shows field-by-field changes
3. Invalid counters (missing signatures) are ignored

### Test Document #4: Handwriting Over Typed
**Expected Results:**
- Immediate rejection with error:
  ```
  "Handwritten modifications over typed text detected - legal violation"
  ```
- Status set to "EXTRACTION_FAILED"
- User sees clear error message

---

## Console Output Examples

### Successful Classification (40-page doc):
```
[classifier] Starting PARALLEL classification: 40 pages → 7 batches of ~6
[classifier:batch1] Processing pages 1–6
[classifier:batch2] Processing pages 7–12
...
[classifier] ✓ All batches complete in 3.2s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[sequential-validator] 📋 RPA BLOCK VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RPA Page Mapping:
  RPA Page 1 → PDF Page 11
  RPA Page 2 → PDF Page 12
  RPA Page 3 → PDF Page 13
  RPA Page 16 → PDF Page 27
  RPA Page 17 → PDF Page 28

✓ Pages 1-3 are consecutive
✓ Pages 16-17 are consecutive

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[classifier] 📋 CLASSIFICATION RESULTS

RPA (Main Contract):
  ✓ RPA Page 1 → PDF Page 11
  ✓ RPA Page 2 → PDF Page 12
  ✓ RPA Page 3 → PDF Page 13
  ✓ RPA Page 16 → PDF Page 27
  ✓ RPA Page 17 → PDF Page 28

Counter Offers (2 pages):
  → PDF Pages: [1, 38]

Addenda: None found

📊 SUMMARY:
   Total pages analyzed: 40
   Critical pages found: 7
   Page numbers: [1, 11, 12, 13, 27, 28, 38]
```

### Counter Offer Merge:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[counter-merger] 📋 MERGING COUNTER OFFERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[counter-merger] Applying SCO #1:
  close_of_escrow: "30" → "21"

[counter-merger] Applying BCO #1:
  purchase_price: "$1,200,000" → "$1,300,000"
  close_of_escrow: "21" → "30"

[counter-merger] ✓ Final acceptance: 12/05/2024 (from BCO #1)
[counter-merger] ✓ Counter chain: RPA → SCO #1 → BCO #1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Error Scenarios & Expected Behavior

### Scenario 1: Missing RPA Page 2
```
[sequential-validator] ✗ RPA block INVALID: Missing RPA Page 2
[process:abc123] Status → EXTRACTION_FAILED
Error: Missing required RPA pages: Missing RPA Page 2
```

### Scenario 2: Invalid Counter (Missing Seller Signature)
```
[counter-merger] ✗ SCO #2 invalid - missing signatures
[counter-merger] Using SCO #1 as final counter
```

### Scenario 3: Handwriting Detection
```
[extractor] ✗ DOCUMENT REJECTED: Handwritten modifications over typed text detected - legal violation
[process:abc123] Status → EXTRACTION_FAILED
```

### Scenario 4: Low Confidence on Critical Field
```
[extractor] ⚠ purchase_price confidence 82% < required 95%
[process:abc123] Status → NEEDS_REVIEW
```

---

## Confidence Threshold Enforcement

The system now enforces these thresholds automatically:

| Field | Threshold | Auto-Reject if Below |
|-------|-----------|---------------------|
| purchase_price | 95% | Yes (NEEDS_REVIEW) |
| property_address | 95% | Yes (NEEDS_REVIEW) |
| close_of_escrow | 95% | Yes (NEEDS_REVIEW) |
| final_acceptance_date | 95% | Yes (NEEDS_REVIEW) |
| buyer_names | 85% | No (warn only) |
| loan_type | 85% | No (warn only) |
| home_warranty | 75% | No (informational) |
| brokerage_info | 75% | No (informational) |

---

## Next Steps for Testing

1. **Run your 40-page test doc** through the updated pipeline
2. Check console logs match expected format above
3. Verify critical page array contains [11, 12, 13, 27, 28, ...]
4. Confirm no pages > 40 in the array
5. Check extraction JSON has all required fields with proper confidence scores

If everything passes, the system is ready for production! 🚀