// src/lib/extractor/debug-classifier.ts
// Version: 1.0.0 - 2025-01-09
// Debugging utilities for classification issues

import { RPA_FORM } from "./form-definitions";

/**
 * Visualize classification results in console with color coding
 */
export function visualizeClassification(
  totalPages: number,
  rpaPages: Record<number, number>,
  counterPages: number[],
  addendumPages: number[]
): void {
  console.log("\n" + "=".repeat(80));
  console.log("CLASSIFICATION VISUALIZATION");
  console.log("=".repeat(80) + "\n");

  // Create array representing all PDF pages
  const pageMap: string[] = Array(totalPages).fill("⚪");

  // Mark RPA pages
  RPA_FORM.requiredInternalPages.forEach((rpaPage) => {
    const pdfPage = rpaPages[rpaPage];
    if (pdfPage && pdfPage <= totalPages) {
      pageMap[pdfPage - 1] = `🟢R${rpaPage}`;
    }
  });

  // Mark counter pages
  counterPages.forEach((page) => {
    if (page <= totalPages) {
      pageMap[page - 1] = "🔵C";
    }
  });

  // Mark addendum pages
  addendumPages.forEach((page) => {
    if (page <= totalPages) {
      pageMap[page - 1] = "🟡A";
    }
  });

  // Print in groups of 10
  for (let i = 0; i < totalPages; i += 10) {
    const chunk = pageMap.slice(i, i + 10);
    const pageNumbers = Array.from({ length: chunk.length }, (_, j) => i + j + 1);
    
    console.log(
      pageNumbers.map((n) => n.toString().padStart(3)).join(" ")
    );
    console.log(chunk.map((s) => s.padStart(3)).join(" "));
    console.log();
  }

  console.log("Legend:");
  console.log("  🟢R1-R17: RPA Pages");
  console.log("  🔵C: Counter Offer");
  console.log("  🟡A: Addendum");
  console.log("  ⚪: Not classified\n");
  console.log("=".repeat(80) + "\n");
}

/**
 * Generate a detailed classification report
 */
export function generateClassificationReport(
  totalPages: number,
  rpaPages: Record<number, number>,
  counterPages: number[],
  addendumPages: number[]
): string {
  const lines: string[] = [];

  lines.push("# Classification Report");
  lines.push("");
  lines.push(`Total Pages: ${totalPages}`);
  lines.push(`RPA Pages Found: ${Object.keys(rpaPages).length}/5 required`);
  lines.push(`Counter Pages: ${counterPages.length}`);
  lines.push(`Addendum Pages: ${addendumPages.length}`);
  lines.push("");

  // RPA pages detail
  lines.push("## RPA Pages");
  RPA_FORM.requiredInternalPages.forEach((rpaPage) => {
    const pdfPage = rpaPages[rpaPage];
    if (pdfPage) {
      lines.push(`  ✓ Page ${rpaPage} → PDF Page ${pdfPage}`);
    } else {
      lines.push(`  ✗ Page ${rpaPage} → NOT FOUND`);
    }
  });
  lines.push("");

  // Sequential check
  const pages123 = [rpaPages[1], rpaPages[2], rpaPages[3]]
    .filter(Boolean)
    .sort((a, b) => a - b);
  const isSequential123 =
    pages123.length === 3 &&
    pages123[1] === pages123[0] + 1 &&
    pages123[2] === pages123[1] + 1;

  const pages1617 = [rpaPages[16], rpaPages[17]]
    .filter(Boolean)
    .sort((a, b) => a - b);
  const isSequential1617 =
    pages1617.length === 2 && pages1617[1] === pages1617[0] + 1;

  lines.push("## Sequential Analysis");
  lines.push(
    `  Pages 1-3: ${isSequential123 ? "✓ Consecutive" : "✗ Non-consecutive"}`
  );
  lines.push(
    `  Pages 16-17: ${isSequential1617 ? "✓ Consecutive" : "✗ Non-consecutive"}`
  );
  lines.push("");

  // Counter pages
  if (counterPages.length > 0) {
    lines.push("## Counter Offers");
    counterPages.sort((a, b) => a - b);
    lines.push(`  Pages: [${counterPages.join(", ")}]`);
    lines.push("");
  }

  // Addendum pages
  if (addendumPages.length > 0) {
    lines.push("## Addenda");
    addendumPages.sort((a, b) => a - b);
    lines.push(`  Pages: [${addendumPages.join(", ")}]`);
    lines.push("");
  }

  // Critical page array
  const criticalPages = [
    ...Object.values(rpaPages),
    ...counterPages,
    ...addendumPages,
  ]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const uniqueCriticalPages = [...new Set(criticalPages)];

  lines.push("## Critical Pages Array");
  lines.push(`  [${uniqueCriticalPages.join(", ")}]`);
  lines.push(`  Total: ${uniqueCriticalPages.length} pages`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Check for common classification issues
 */
export function diagnoseClassificationIssues(
  totalPages: number,
  rpaPages: Record<number, number>,
  counterPages: number[],
  addendumPages: number[]
): string[] {
  const issues: string[] = [];

  // Check for missing required pages
  RPA_FORM.requiredInternalPages.forEach((rpaPage) => {
    if (!rpaPages[rpaPage]) {
      issues.push(
        `CRITICAL: Missing RPA Page ${rpaPage} - extraction will fail`
      );
    }
  });

  // Check for pages beyond document length
  const allPages = [
    ...Object.values(rpaPages),
    ...counterPages,
    ...addendumPages,
  ];
  const invalidPages = allPages.filter((p) => p > totalPages);
  if (invalidPages.length > 0) {
    issues.push(
      `ERROR: Found ${invalidPages.length} page(s) beyond document length (${totalPages}): [${invalidPages.join(", ")}]`
    );
  }

  // Check for sequential issues
  const pages123 = [rpaPages[1], rpaPages[2], rpaPages[3]]
    .filter(Boolean)
    .sort((a, b) => a - b);
  const isSequential123 =
    pages123.length === 3 &&
    pages123[1] === pages123[0] + 1 &&
    pages123[2] === pages123[1] + 1;

  if (!isSequential123 && pages123.length === 3) {
    issues.push(
      `WARNING: RPA Pages 1-3 not consecutive (found at PDF pages ${pages123.join(", ")})`
    );
  }

  const pages1617 = [rpaPages[16], rpaPages[17]]
    .filter(Boolean)
    .sort((a, b) => a - b);
  const isSequential1617 =
    pages1617.length === 2 && pages1617[1] === pages1617[0] + 1;

  if (!isSequential1617 && pages1617.length === 2) {
    issues.push(
      `WARNING: RPA Pages 16-17 not consecutive (found at PDF pages ${pages1617.join(", ")})`
    );
  }

  // Check for suspiciously high number of critical pages
  const criticalCount = new Set([
    ...Object.values(rpaPages),
    ...counterPages,
    ...addendumPages,
  ]).size;

  if (criticalCount > totalPages * 0.5) {
    issues.push(
      `WARNING: ${criticalCount} critical pages out of ${totalPages} total (${Math.round((criticalCount / totalPages) * 100)}%) - may be over-detecting`
    );
  }

  // Check for no counter pages (unusual but not an error)
  if (counterPages.length === 0 && addendumPages.length === 0) {
    issues.push(
      `INFO: No counter offers or addenda detected - this is unusual for CA contracts`
    );
  }

  return issues;
}

/**
 * Export classification data for debugging
 */
export function exportClassificationDebugData(
  totalPages: number,
  rpaPages: Record<number, number>,
  counterPages: number[],
  addendumPages: number[]
): object {
  return {
    timestamp: new Date().toISOString(),
    totalPages,
    rpaPages,
    counterPages,
    addendumPages,
    criticalPages: [
      ...Object.values(rpaPages),
      ...counterPages,
      ...addendumPages,
    ]
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b),
    issues: diagnoseClassificationIssues(
      totalPages,
      rpaPages,
      counterPages,
      addendumPages
    ),
    report: generateClassificationReport(
      totalPages,
      rpaPages,
      counterPages,
      addendumPages
    ),
  };
}