// src/lib/extraction/grok/textClassify.ts
// Version: 1.1.0 - 2026-01-08
// Calls Grok text model (grok-4-1-fast-reasoning) to classify pages using OCR markdown
// FIX: Use XAI_API_KEY (correct env var) + parse chat completion format correctly

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

  const systemPrompt = `You are a JSON-only page classifier. Given an ordered array of page markdown texts, return a single JSON object that strictly conforms to the classifier schema (pageCount and pages array). Return NOTHING but the JSON. Use null for pages with no relevant contract content. Fields should use the language from the provided schema (pdfPage, role, formCode, contentCategory, hasFilledFields, confidence, etc.).`;

  const example = `Example output for a 3-page document:\n{\n  "state": "CA",\n  "pageCount": 3,\n  "pages": [\n    {"pdfPage":1,"formCode":"RPA","role":"main_contract","contentCategory":"transaction_terms","hasFilledFields":true,"confidence":95},\n    null,\n    {"pdfPage":3,"formCode":null,"role":"addendum","contentCategory":"boilerplate","hasFilledFields":false,"confidence":60}\n  ]\n}`;

  const userPrompt = `Document pageCount: ${pageCount}\n\nPages (markdown excerpts):\n${pagesForPrompt
    .map((p, i) => `---- PAGE ${i + 1} ----\n${p || '<EMPTY>'}`)
    .join("\n\n")}\n\nRespond with JSON only. ${example}`;

  let lastError: unknown;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const body = {
        model: "grok-4-1-fast-reasoning",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 3000,
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

      // Extract content from OpenAI-compatible chat completion format
      if (!responseJson.choices?.[0]?.message?.content) {
        throw new Error("Invalid Grok response structure: missing choices[0].message.content");
      }

      const jsonText = responseJson.choices[0].message.content.trim();
      const raw = JSON.stringify(responseJson); // For debugging

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        throw new Error("Invalid JSON in Grok response content");
      }

      // Basic structural checks with proper narrowing
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Parsed response is not a non-null object");
      }

      if (!("pages" in parsed) || !Array.isArray((parsed as any).pages)) {
        throw new Error("Parsed response missing or invalid pages array");
      }

      // AJV validation
      const valid = validate(parsed);
      if (!valid) {
        const errors = (validate.errors || []).map((e: any) => `${e.instancePath} ${e.message}`);
        return { valid: false, errors, raw };
      }

      // Ensure pageCount matches pages length
      const pagesArray = (parsed as any).pages as unknown[];
      if (pagesArray.length !== pageCount) {
        return {
          valid: false,
          errors: [`pageCount mismatch: expected ${pageCount}, got ${pagesArray.length}`],
          raw,
        };
      }

      // At this point, schema validation passed → safe to cast
      const classification = parsed as Classification;

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