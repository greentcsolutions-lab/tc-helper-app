# Grok API Best Practices Review

**Date:** 2026-01-01
**Reviewed by:** Claude Code
**Repository:** tc-helper-app

---

## Executive Summary

Your Grok API implementation demonstrates **strong fundamentals** with temperature control, image preprocessing, and structured prompting. However, there are **critical gaps** in retry logic, SDK usage, JSON mode enablement, and prompt engineering techniques that could be causing the accuracy drop you mentioned in the research (95% chat → 60% API).

**Overall Grade:** B+ (Good fundamentals, missing production-critical features)

---

## ✅ What You're Doing Well

### 1. **Temperature Control** (EXCELLENT)
- ✅ **All calls use `temperature: 0`** for deterministic outputs
- Location: `src/lib/grok/client.ts:128`, `classifier.ts`, `extractor.ts`
- **Aligns perfectly** with research recommendation (0.0-0.2 for OCR tasks)

### 2. **Image Preprocessing** (EXCELLENT)
- ✅ PDF flattening via Nutrient API
- ✅ Consistent 200 DPI PNG rendering
- ✅ Base64 encoding for API transmission
- Location: `src/lib/pdf/renderer.ts`
- **Aligns perfectly** with research: "Preprocess images (e.g., enhance contrast)"

### 3. **Structured JSON Schema** (EXCELLENT)
- ✅ Strict schemas embedded in prompts
- ✅ Type validation via Zod/TypeScript
- ✅ Schema versioning (extractor v12.0.0, classifier v6.0.0)
- **Aligns perfectly** with research: "Strict JSON schema for outputs"

### 4. **Response Validation** (GOOD)
- ✅ `validateFinishReason()` checks for truncation (`finish_reason === 'length'`)
- ✅ Post-extraction validation with second-turn retry
- ✅ Enhanced logging (v2.2.0) for debugging
- Location: `src/lib/grok/client.ts:242-268`
- **Aligns well** with research: "Validate outputs post-API"

### 5. **Clear Extraction Rules** (GOOD)
- ✅ Constraints: "Return null ONLY if field is truly not visible"
- ✅ Explicit per-page independence rules (extractor v12.0.0)
- ✅ Universal U.S. real estate terminology mapping
- **Aligns well** with research: "Constraints (e.g., 'Extract only visible data')"

### 6. **Role Assignment** (PARTIAL)
- ✅ Extractor: "You are a document OCR specialist"
- ⚠️ Classifier: "You are a U.S. real estate document page classifier"
- **Aligns partially** with research: role is present but not as strong as "OCR specialist"

---

## ❌ Critical Gaps (High Priority Fixes)

### 1. **No SDK Usage** (CRITICAL)
**Current:** Direct `fetch()` calls to `https://api.x.ai/v1/chat/completions`

**Research says:** "Use SDKs for requests"

**Why this matters:**
- SDKs handle retries, rate limiting, and error handling automatically
- OpenAI-compatible SDKs work with xAI endpoints
- Reduces boilerplate and prevents subtle bugs

**Recommendation:**
```typescript
// Install OpenAI SDK (works with xAI)
npm install openai

// Replace fetch() calls with:
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

const response = await client.chat.completions.create({
  model: 'grok-4-1-fast-reasoning',
  temperature: 0,
  max_tokens: 6144,
  messages: [...],
});
```

**Files to update:**
- `src/lib/grok/client.ts:155-162`
- `src/lib/extraction/extract/universal/second-turn.ts` (currently bypasses centralized client)

---

### 2. **No JSON Mode Enabled** (CRITICAL)
**Current:** Relies on prompt instructions + bracket-depth parsing algorithm

**Research says:** "Enable JSON mode"

**Why this matters:**
- xAI/OpenAI support `response_format: { type: "json_object" }` for guaranteed JSON
- Eliminates need for bracket-depth parsing fallbacks
- Reduces parsing errors and improves reliability

**Recommendation:**
```typescript
const requestBody = {
  model: 'grok-4-1-fast-reasoning',
  temperature: 0,
  max_tokens: 6144,
  response_format: { type: 'json_object' }, // ⬅️ ADD THIS
  messages: [...],
};
```

**Files to update:**
- `src/lib/grok/client.ts:136-149`

**Note:** You can still keep `extractJSONFromGrokResponse()` as a fallback, but JSON mode should prevent needing it.

---

### 3. **No Retry Logic with Exponential Backoff** (CRITICAL)
**Current:** No retries. Single API call failure = extraction failure.

**Research says:** "Implement retries/backoff for rate limits"

**Why this matters:**
- Network glitches cause transient failures
- Rate limits (429 errors) are common in production
- Research mentions this as a key difference between chat and API reliability

**Recommendation:**
```typescript
async function callGrokAPIWithRetry<T>(
  prompt: string,
  pages: GrokPage[],
  options: GrokCallOptions,
  totalPagesInDocument?: number,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callGrokAPI<T>(prompt, pages, options, totalPagesInDocument);
    } catch (error) {
      lastError = error as Error;

      // Don't retry validation errors (bad prompts, content filters)
      if (error.message.includes('content_filter') || error.message.includes('invalid')) {
        throw error;
      }

      // Retry on network/rate limit errors
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`${options.logPrefix}:retry] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError!;
}
```

**Files to update:**
- `src/lib/grok/client.ts` (add retry wrapper)
- `src/lib/extraction/classify/classifier.ts:classifyBatch()`
- `src/lib/extraction/extract/universal/index.ts:extractPerPage()`

---

### 4. **No Few-Shot Examples** (HIGH PRIORITY)
**Current:** Only rule-based instructions

**Research says:** "Few-shot examples" as critical component of prompt structure

**Why this matters:**
- Research shows few-shot examples dramatically improve accuracy
- Especially important for edge cases (counter offers, addenda, partial signatures)
- Grok learns better from examples than from rules alone

**Recommendation:**
Add 2-3 example extractions to your prompts:

```typescript
// In universal-extractor-prompt.ts, add after schema:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE EXTRACTIONS (LEARN FROM THESE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Example 1: Main Contract Page with Transaction Terms**

Input image shows:
---
Property: 123 Oak Street, Austin, TX 78701
Purchase Price: $450,000
Earnest Money: $5,000
Closing Date: 30 days from effective date
☑ Conventional  ☐ FHA  ☐ VA
---

Expected output:
{
  "pageNumber": 1,
  "pageLabel": "PDF_Page_1",
  "pageRole": "main_contract",
  "propertyAddress": "123 Oak Street, Austin, TX 78701",
  "buyerNames": null,
  "sellerNames": null,
  "purchasePrice": 450000,
  "earnestMoneyDeposit": 5000,
  "closingDate": "30 days from effective date",
  "financingType": "conventional",
  "buyerSignatureDates": null,
  "sellerSignatureDates": null
}

**Example 2: Signature Page with No Transaction Terms**

Input image shows:
---
Property: 123 Oak Street, Austin, TX 78701 (header)
[Dense legal boilerplate about default remedies]
Buyer: John Doe    Date: 1/15/2024
Buyer: Jane Doe    Date: 1/15/2024
Seller: Bob Smith  Date: 1/10/2024
---

Expected output:
{
  "pageNumber": 9,
  "pageLabel": "PDF_Page_9",
  "pageRole": "main_contract",
  "propertyAddress": "123 Oak Street, Austin, TX 78701",
  "buyerNames": ["John Doe", "Jane Doe"],
  "sellerNames": ["Bob Smith"],
  "purchasePrice": null,
  "earnestMoneyDeposit": null,
  "closingDate": null,
  "financingType": null,
  "buyerSignatureDates": ["1/15/2024", "1/15/2024"],
  "sellerSignatureDates": ["1/10/2024"]
}

**Example 3: Counter Offer with Modified Price**

Input image shows:
---
SELLER COUNTER OFFER NO. 1
Property: 123 Oak Street, Austin, TX 78701
Seller counters as follows:
1. Purchase Price is changed to: $465,000
2. Close of Escrow is changed to: 45 days from acceptance
Buyer: ___________  Date: ___
Seller: Mary Johnson  Date: 1/12/2024
---

Expected output:
{
  "pageNumber": 18,
  "pageLabel": "PDF_Page_18",
  "pageRole": "counter_offer",
  "propertyAddress": "123 Oak Street, Austin, TX 78701",
  "buyerNames": null,
  "sellerNames": ["Mary Johnson"],
  "purchasePrice": 465000,
  "earnestMoneyDeposit": null,
  "closingDate": "45 days from acceptance",
  "financingType": null,
  "buyerSignatureDates": null,
  "sellerSignatureDates": ["1/12/2024"]
}
```

**Files to update:**
- `src/lib/extraction/prompts/universal-extractor-prompt.ts` (add examples section)
- `src/lib/extraction/prompts/classifier-prompt.ts` (add classification examples)

---

### 5. **No Chain-of-Thought Guidance** (MEDIUM PRIORITY)
**Current:** Direct extraction instructions

**Research says:** "Step-by-step chain-of-thought guidance"

**Why this matters:**
- CoT forces Grok to "show its work" before outputting JSON
- Reduces hallucinations and improves accuracy on complex documents
- Especially helpful for multi-page documents with conflicting data

**Recommendation:**
Add step-by-step reasoning instructions:

```typescript
// Add to extractor prompt BEFORE "OUTPUT FORMAT":

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION PROCESS (FOLLOW THESE STEPS FOR EACH IMAGE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each image, mentally follow these steps:

Step 1: Identify the page type
  - Look at the header/title: Is this a main contract, counter offer, addendum, or signature page?
  - Check the footer: What form code and page number?

Step 2: Scan for property address
  - Look at the TOP 20% of the page first (header tables)
  - Check for labels: "Property:", "Property Address:", "Subject Property:"
  - If not found in header, scan the first major section

Step 3: Scan for transaction terms (if applicable)
  - Purchase price / Sales price
  - Earnest money / Deposit
  - Closing date / Close of escrow
  - Financing checkboxes

Step 4: Scan for names (if applicable)
  - Buyer names (may be in header or signature blocks)
  - Seller names (often only visible on signature pages)

Step 5: Scan for signature dates
  - Find signature blocks labeled "Buyer" or "Seller"
  - Extract dates EXACTLY as written (do not normalize)
  - Ignore agent/broker signature dates

Step 6: Build the JSON object
  - Use null for any field not visible on THIS specific page
  - Double-check that you're not copying data from other pages

Now extract the data following these steps.
```

**Files to update:**
- `src/lib/extraction/prompts/universal-extractor-prompt.ts`

---

### 6. **Output Prefilling NOT SUPPORTED** (TESTED AND REJECTED)
**Current:** Grok generates full response without prefilling

**Research says:** "Prefill outputs (e.g., start with '{') to force format adherence"

**❌ TESTED AND FAILED:** xAI's Grok API does NOT support assistant message prefilling like Anthropic's Claude does.

**What happened when we tried:**
- Added assistant message with `{` or `[` character
- Grok responded with:
  - Explanatory preamble: `{Assistant: First, the output must be...`
  - Double opening braces: `{{` instead of `{`
  - Truncated/malformed responses
- All classification batches failed to parse

**Conclusion:** xAI interprets assistant messages differently than Anthropic. The assistant role confuses the model rather than guiding it.

**Status:** **REVERTED** in v5.1.0

**Files updated:**
- `src/lib/grok/client.ts` (removed prefilling logic)

---

### 7. **Minimal Section Delimiters** (LOW PRIORITY)
**Current:** Uses `━━━━━` for major sections

**Research says:** "Use delimiters like ### to separate sections"

**Why this matters:**
- Research suggests `###` markers help models distinguish sections
- Your current delimiters work but could be clearer

**Recommendation:**
- Keep your `━━━━━` style (it's working), but add `###` markers for clarity:

```typescript
### CRITICAL: PER-PAGE INDEPENDENCE
[instructions]

### EXTRACTION RULES
[instructions]

### FIELD EXTRACTION
[instructions]

### OUTPUT FORMAT
[instructions]
```

**Files to update:**
- `src/lib/extraction/prompts/universal-extractor-prompt.ts`
- `src/lib/extraction/prompts/classifier-prompt.ts`

---

### 8. **No Explicit Image Element References** (LOW PRIORITY)
**Current:** Generic "look at the image" instructions

**Research says:** "Explicitly reference image elements in prompts to guide extraction"

**Why this matters:**
- Vision models perform better when you direct their attention
- "Look at the top 20%" is better than "look at the page"

**Current strengths:**
- ✅ You already have some: "Look at the TOP of the page first"
- ✅ "In header tables or labeled 'Property:'"

**Recommendation:**
Add more spatial references:

```typescript
**PROPERTY ADDRESS** - Visual search pattern:
  1. First, scan the TOP 20% of the page (header region)
  2. Look for boxed/bordered table sections
  3. Check the left margin for labels ending with ":"
  4. If not found, scan the first major text block (top 1/3 of page)
  5. Common visual patterns:
     - Bold text above address line
     - Underlined field labels
     - Table cells with "Property" label
```

**Files to update:**
- `src/lib/extraction/prompts/universal-extractor-prompt.ts`

---

### 9. **Second-Turn Bypasses Centralized Client** (CODE QUALITY)
**Current:** `second-turn.ts` makes direct fetch() calls instead of using `callGrokAPI()`

**Why this matters:**
- Duplicates code
- Bypasses validation (finish_reason checks)
- Misses enhanced logging from v2.2.0
- Harder to maintain

**Recommendation:**
Refactor second-turn to use centralized client:

```typescript
// In src/lib/extraction/extract/universal/second-turn.ts
import { callGrokAPIWithValidation } from '@/lib/grok/client';

// Replace direct fetch() with:
const result = await callGrokAPIWithValidation<PerPageExtraction[]>(
  buildSecondTurnPrompt(previousExtraction, problemFields),
  relevantPages,
  {
    logPrefix: '[Second-Turn]',
    maxTokens: 8192,
    expectObject: false,
  },
  totalPagesInDocument
);
```

**Files to update:**
- `src/lib/extraction/extract/universal/second-turn.ts`

---

## 🔍 Comparison to Research Findings

### Research Quote:
> "Reasons for accuracy drops in API (as discussed) often include **mismatched defaults**, **image processing issues**, **lack of implicit chat prompts**, or **scaling errors**—addressable by aligning configurations closely with chat setups."

### Your Situation Analysis:

| Potential Issue | Your Implementation | Status |
|-----------------|---------------------|--------|
| **Mismatched defaults** | ✅ Temperature = 0 (matches chat determinism) | GOOD |
| **Image processing issues** | ✅ 200 DPI PNG, PDF flattening | GOOD |
| **Lack of implicit chat prompts** | ⚠️ No few-shot examples, no CoT | **LIKELY ISSUE** |
| **Scaling errors** | ❌ No retry logic, no rate limit handling | **LIKELY ISSUE** |
| **JSON mode not enabled** | ❌ Relying on bracket-depth parsing | **LIKELY ISSUE** |

### Hypothesis:
Your accuracy drop from 95% (chat) to 60% (API) is likely caused by:

1. **Missing few-shot examples** → Model doesn't learn from concrete cases
2. **No JSON mode** → Parsing failures on malformed responses
3. **No retry logic** → Transient failures counted as extraction failures
4. **No SDK** → Missing implicit error handling and retries

---

## 📊 Prioritized Action Plan

### Phase 1: Critical Fixes (Do This Week)
1. **Enable JSON mode** in `callGrokAPI()` - 5 min fix, high impact
2. **Add retry logic with exponential backoff** - 30 min fix, prevents transient failures
3. **Add few-shot examples** to extractor prompt - 1 hour, likely biggest accuracy boost

### Phase 2: Production Hardening (Do This Month)
4. **Switch to OpenAI SDK** - 2 hours, better reliability
5. **Add chain-of-thought guidance** - 1 hour, improves complex document handling
6. **Refactor second-turn to use centralized client** - 30 min, code quality

### Phase 3: Polish (Do When Time Permits)
7. **Add output prefilling** - 15 min (if xAI supports it)
8. **Enhance section delimiters** - 15 min
9. **Add more spatial image references** - 30 min

---

## 📝 Implementation Checklist

- [x] Enable `response_format: { type: 'json_object' }` in API calls ✅
- [x] Implement `callGrokAPIWithRetry()` wrapper with exponential backoff ✅
- [x] Add 3 few-shot examples to universal extractor prompt ✅
- [x] Add 2 few-shot examples to classifier prompt ✅
- [x] Install and configure OpenAI SDK for xAI endpoint ✅
- [x] Replace all `fetch()` calls with SDK calls ✅
- [x] Add step-by-step chain-of-thought section to extractor prompt ✅
- [x] Refactor `second-turn.ts` to use `callGrokAPIWithValidation()` ✅
- [x] ~~Test output prefilling~~ **REJECTED** - xAI doesn't support it ❌
- [x] Enhance section delimiters with `###` markers ✅
- [x] Add spatial visual guidance for property address extraction ✅

**Score: 10/11 implemented** (output prefilling not supported by xAI)

---

## 🎯 Expected Impact

**Before fixes:**
- Accuracy: ~60% (API)
- Reliability: Low (no retries)
- Maintainability: Medium (code duplication)

**After Phase 1 fixes:**
- Accuracy: ~85-90% (JSON mode + few-shot examples)
- Reliability: Medium (retry logic)
- Maintainability: Medium

**After all phases:**
- Accuracy: ~95%+ (matching chat performance)
- Reliability: High (SDK + retries + validation)
- Maintainability: High (centralized, well-structured code)

---

## 📚 Additional Recommendations

### 1. **Monitor Finish Reasons**
Add metrics tracking:
- How often `finish_reason === 'length'` (response truncated)
- How often `finish_reason === 'content_filter'` (blocked)
- Adjust `max_tokens` if truncation is common

### 2. **A/B Test Temperature**
Research says 0.0-0.2 is ideal, but you might test:
- 0.0 (current, most deterministic)
- 0.1 (slight variance, may help with edge cases)

### 3. **Cache Prompts**
Your prompts are deterministic (no dynamic content except image count). Consider:
- Using xAI's prompt caching (if available)
- Reduces cost and latency

### 4. **Batch Size Optimization**
- Classifier: 15 pages per batch (current)
- Extractor: Per-page processing (current)

Research finding: Larger batches can cause context bleeding. Your per-page approach is correct.

---

## 🚨 Red Flags to Watch

1. **If `max_tokens: 6144` causes truncation:**
   - Increase to 8192 or 16384
   - Check finish_reason logs

2. **If retry logic hits max retries frequently:**
   - Investigate rate limits
   - Consider request throttling

3. **If few-shot examples don't improve accuracy:**
   - Your examples might not match real-world diversity
   - Add more edge case examples (counter offers, amendments)

---

## ✅ What You're Already Doing Right (Don't Change)

1. ✅ **Temperature = 0** - Perfect for OCR
2. ✅ **Per-page independence** - Prevents context bleeding
3. ✅ **Image preprocessing** - 200 DPI PNG is ideal
4. ✅ **Validation + second-turn retry** - Smart error recovery
5. ✅ **Enhanced logging** - Critical for debugging
6. ✅ **Bracket-depth parsing** - Good fallback (but shouldn't be primary with JSON mode)

---

## 📖 References

- Research summary provided by user
- xAI Grok API docs: https://docs.x.ai/api
- OpenAI SDK (compatible with xAI): https://github.com/openai/openai-node
- Best practices: Temperature 0.0-0.2, JSON mode, few-shot examples, CoT reasoning

---

**Next Steps:** Review this analysis, prioritize Phase 1 fixes, and let me know if you'd like help implementing any of these recommendations.
