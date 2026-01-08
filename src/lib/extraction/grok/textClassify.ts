// src/lib/extraction/grok/textClassify.ts
// Version: 1.5.0 - 2026-01-08
// Calls Grok text model (grok-4-1-fast-reasoning) to classify pages using OCR markdown
// FIX: Use XAI_API_KEY (correct env var) + parse chat completion format correctly
// FIX: Add debug logging (limited to avoid Vercel log size limits)
// FIX: Include full schema in prompt with valid enum values + enforce exact array length
// FIX: Dynamic max_tokens scaling (100 tokens/page + 2k buffer, cap 16k) - supports up to 140 pages
// FIX: Tighten prompt - explicit rules for boilerplate vs transaction_terms + ignore header fields

import Ajv from "ajv";
import addFormats from "ajv-formats";
import classifierSchema from "@/forms/classifier.schema.json";

const GROK_API_URL = process.env.GROK_API_URL || "https://api.x.ai/v1/chat/completions";
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!XAI_API_KEY) {
  throw new Error("XAI_API_KEY environment variable is required");
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv as any);
const validate = ajv.compile(classifierSchema as any);

interface PageClassification {
  pdfPage?: number;
  state?: string | null;
  formCode?: string | null;
  formRevision?: string | null;
  formPage?: number | null;
  totalPagesInForm?: number | null;
  role: string;
  titleSnippet?: string | null;
  confidence?: number;
  contentCategory: string;
  hasFilledFields?: boolean;
}

interface Classification {
  state?: string | null;
  pageCount: number;
  pages: (PageClassification | null)[];
}

export async function callGrokTextClassify(
  markdownPages: string[],
  pageCount: number
): Promise<{
  valid: boolean;
  classification?: Classification;
  errors?: string[];
  raw?: string;
}> {
  // Truncate page markdowns to a reasonable size to keep the request smaller
  const pagesForPrompt = markdownPages.map((m) => (m ? m.slice(0, 4000) : ""));

  // Include the schema definition for strict compliance
  const schemaDefinition = JSON.stringify(classifierSchema, null, 2);

  const systemPrompt = `You are a JSON-only page classifier for real estate contract documents.

CRITICAL REQUIREMENTS:
1. Return a JSON object that EXACTLY matches the schema below
2. The "pages" array MUST have exactly ${pageCount} entries (one per page, in order)
3. Each entry can be:
   - null (for pages with no recognizable standard form or key content)
   - OR an object with the required fields specified in the schema
4. ONLY use enum values from the schema - DO NOT invent new values
5. If unsure about a value, use "other" for role/contentCategory

SCHEMA (your response MUST validate against this):
${schemaDefinition}

KEY ENUM VALUES TO USE:
- role: main_contract, counter_offer, addendum, local_addendum, contingency_release, disclosure, financing, broker_info, title_page, other
- contentCategory: transaction_terms, signatures, broker_info, disclosures, boilerplate, other

CRITICAL: contentCategory Classification Rules
----------------------------------------------
"transaction_terms" = Pages with SUBSTANTIVE fillable transaction data in the MAIN BODY:
  ✓ Purchase price, earnest money, deposit amounts
  ✓ Closing dates, contingency dates, possession dates
  ✓ Property condition terms, repairs, inspections
  ✓ Financing terms, loan conditions
  ✓ Contingency details (appraisal, loan, inspection)
  ✓ Addenda/amendments lists, special terms

"boilerplate" = Dense legal text with minimal/no fillable fields in MAIN BODY:
  ✓ Pages that are 80%+ pre-printed legal paragraphs
  ✓ Standard contract terms, definitions, legal disclaimers
  ✓ General provisions, default clauses, arbitration text
  ✗ IGNORE property address and date in headers when evaluating this

"signatures" = Pages primarily containing signature blocks and dates (even if unsigned)

CRITICAL: hasFilledFields Evaluation Rules
-------------------------------------------
Set to TRUE only if the MAIN BODY (not headers/footers) has 3+ substantive filled fields:
  ✓ Count: dollar amounts, dates, checkboxes, property details, names IN THE BODY
  ✗ IGNORE: property address in header, form date in header, page numbers
  ✗ If only header fields are filled → hasFilledFields = FALSE
  ✗ If page is mostly dense legal text with <3 body fields → hasFilledFields = FALSE

Examples:
- RPA page with purchase price, closing date, earnest money → transaction_terms, hasFilledFields=true
- RPA page with only dense legal paragraphs (general provisions) → boilerplate, hasFilledFields=false
- Counter offer with modified terms → transaction_terms, hasFilledFields=true
- Disclosure form (AD, BIA) → disclosures, hasFilledFields=false

Return ONLY the JSON object. No markdown formatting, no explanations.`;

  const example = `Example for a 3-page document:
{
  "state": "CA",
  "pageCount": 3,
  "pages": [
    {"pdfPage":1,"formCode":"RPA","role":"main_contract","contentCategory":"transaction_terms","hasFilledFields":true,"confidence":95},
    {"pdfPage":2,"formCode":"RPA","role":"main_contract","contentCategory":"signatures","hasFilledFields":true,"confidence":90},
    null
  ]
}`;

  const userPrompt = `Classify this ${pageCount}-page real estate document. Return JSON with EXACTLY ${pageCount} entries in the pages array.

Pages (markdown excerpts):
${pagesForPrompt
    .map((p, i) => `---- PAGE ${i + 1} ----\n${p || '<EMPTY>'}`)
    .join("\n\n")}

${example}

Your response must validate against the schema. Respond with JSON only.`;

  let lastError: unknown;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Dynamic token scaling: ~100 tokens/page + 2000 buffer, capped at 16k
      // For 47 pages: 6,700 tokens | For 100 pages: 12,000 tokens | Max: 16,000 tokens
      const maxTokens = Math.min(pageCount * 100 + 2000, 16000);

      const body = {
        model: "grok-4-1-fast-reasoning",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: maxTokens,
      };

      const res = await fetch(GROK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        lastError = new Error(`Grok API error ${res.status}: ${text}`);
        if (res.status >= 500 || res.status === 429) {
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
        }
        throw lastError;
      }

      // Parse the chat completion response
      const responseJson = await res.json();

      // Log response structure (not full content to avoid Vercel limits)
      console.log("[grokClassify] Response structure:", {
        hasChoices: !!responseJson.choices,
        choicesLength: responseJson.choices?.length,
        hasMessage: !!responseJson.choices?.[0]?.message,
        hasContent: !!responseJson.choices?.[0]?.message?.content,
        contentLength: responseJson.choices?.[0]?.message?.content?.length,
      });

      // Extract content from OpenAI-compatible chat completion format
      if (!responseJson.choices?.[0]?.message?.content) {
        console.error("[grokClassify] Invalid response structure. Top-level keys:", Object.keys(responseJson));
        throw new Error("Invalid Grok response structure: missing choices[0].message.content");
      }

      const jsonText = responseJson.choices[0].message.content.trim();
      const raw = JSON.stringify(responseJson); // For debugging

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
        const parsedObj = parsed as any;

        // Log structure with sample of first 2 pages
        console.log("[grokClassify] Parsed JSON structure:", {
          keys: Object.keys(parsedObj),
          state: parsedObj.state,
          pageCount: parsedObj.pageCount,
          pagesArrayLength: parsedObj.pages?.length,
          firstTwoPages: parsedObj.pages?.slice(0, 2),
        });
      } catch (e) {
        console.error("[grokClassify] Failed to parse JSON. First 1000 chars:", jsonText.substring(0, 1000));
        throw new Error("Invalid JSON in Grok response content");
      }

      // Basic structural checks with proper narrowing
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        console.error("[grokClassify] Validation failed: not a non-null object. Type:", typeof parsed);
        throw new Error("Parsed response is not a non-null object");
      }

      if (!("pages" in parsed) || !Array.isArray((parsed as any).pages)) {
        console.error("[grokClassify] Validation failed: missing pages array. Keys:", Object.keys(parsed as object));
        throw new Error("Parsed response missing or invalid pages array");
      }

      // AJV validation
      const valid = validate(parsed);
      if (!valid) {
        const errors = (validate.errors || []).map((e: any) => `${e.instancePath} ${e.message}`);
        console.error("[grokClassify] Schema validation failed:", errors);

        // Extract failing page indices from error messages
        const failingIndices = new Set<number>();
        errors.forEach((err: string) => {
          const match = err.match(/^\/pages\/(\d+)/);
          if (match) failingIndices.add(parseInt(match[1]));
        });

        // Log sample of failing pages to see invalid enum values
        const failingPagesSample = Array.from(failingIndices).slice(0, 5).map(idx => ({
          index: idx,
          page: (parsed as any).pages?.[idx]
        }));

        console.error("[grokClassify] Sample of failing pages:", JSON.stringify(failingPagesSample, null, 2));
        console.error("[grokClassify] Summary:", {
          state: (parsed as any).state,
          pageCount: (parsed as any).pageCount,
          pagesArrayLength: (parsed as any).pages?.length,
          expectedLength: pageCount,
          missingPages: pageCount - ((parsed as any).pages?.length || 0),
        });
        return { valid: false, errors, raw };
      }

      // Ensure pageCount matches pages length
      const pagesArray = (parsed as any).pages as unknown[];
      console.log(`[grokClassify] Checking pageCount: expected ${pageCount}, got ${pagesArray.length} pages`);
      if (pagesArray.length !== pageCount) {
        console.error(`[grokClassify] Page count mismatch: expected ${pageCount}, got ${pagesArray.length}`);
        return {
          valid: false,
          errors: [`pageCount mismatch: expected ${pageCount}, got ${pagesArray.length}`],
          raw,
        };
      }

      // At this point, schema validation passed → safe to cast
      const classification = parsed as Classification;

      console.log(`[grokClassify] ✅ Schema validation passed! Normalizing ${classification.pages.length} pages...`);

      // Normalize pages: ensure pdfPage set and confidences clamped
      classification.pages = classification.pages.map((p, idx) => {
        if (p === null) return null;

        return {
          pdfPage: p.pdfPage ?? idx + 1,
          state: p.state ?? null,
          formCode: p.formCode ?? null,
          formRevision: p.formRevision ?? null,
          formPage: p.formPage ?? null,
          totalPagesInForm: p.totalPagesInForm ?? null,
          role: p.role,
          titleSnippet: p.titleSnippet ?? null,
          confidence: Math.max(0, Math.min(100, Number(p.confidence ?? 0))),
          contentCategory: p.contentCategory,
          hasFilledFields: Boolean(p.hasFilledFields),
        };
      });

      console.log(`[grokClassify] ✅ Successfully classified ${pageCount} pages`);
      return { valid: true, classification, raw };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = new Error(message);
      console.log(`[grokClassify] Retry ${attempt}/${maxRetries} after error: ${message}`);

      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  return { valid: false, errors: [lastError instanceof Error ? lastError.message : String(lastError)] };
}