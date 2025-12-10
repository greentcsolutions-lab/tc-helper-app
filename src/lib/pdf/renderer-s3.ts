// src/lib/pdf/renderer-s3.ts
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (!process.env.NUTRIENT_API_KEY?.trim()) {
  throw new Error("Missing NUTRIENT_API_KEY");
}
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("Missing AWS credentials");
}
if (!process.env.S3_BUCKET) {
  throw new Error("Missing S3_BUCKET");
}

const NUTRIENT_S3_ENDPOINT = "https://api.nutrient.io/s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-west-2",
});

export interface S3RenderResult {
  zipKey: string;
  zipUrl: string;
  pageCount: number;
  renderedAt: string;
}

export interface RenderToS3Options {
  parseId: string;
  maxPages?: number;
  dpi?: number;
}

export async function renderPdfToS3Direct(
  pdfBuffer: Buffer,
  options: RenderToS3Options
): Promise<S3RenderResult> {
  const { parseId, maxPages, dpi = 310 } = options;

  const zipKey = `renders/${parseId}/document-${Date.now()}.zip`;

  console.log("[Nutrient → S3] Starting direct render", {
    parseId,
    zipKey,
    maxPages: maxPages || "all",
    dpi,
    fileSizeMB: (pdfBuffer.length / 1e6).toFixed(2),
  });

  if (!pdfBuffer.subarray(0, 8).toString().includes("%PDF")) {
    throw new Error("Invalid PDF file");
  }

  // THE ONLY FIX THAT ACTUALLY WORKS IN 2025
  const form = new FormData();
  form.append(
    "document",
    new Blob([pdfBuffer as any], { type: "application/pdf" }),
    "document.pdf"
  );

  // Alternative (also works, slightly cleaner):
  // form.append("document", new Blob([pdfBuffer.buffer], { type: "application/pdf" }), "document.pdf");

  const instructions = {
    parts: [{ file: "document" }],
    actions: [{ type: "flatten" }],
    output: {
      type: "image",
      format: "png",
      dpi,
      compression: "store",
    },
    destination: {
      provider: "aws_s3",
      bucket: process.env.S3_BUCKET,
      key: zipKey,
      region: process.env.AWS_REGION || "us-west-2",
    },
  };

  form.append("instructions", JSON.stringify(instructions));

  const res = await fetch(NUTRIENT_S3_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NUTRIENT_API_KEY}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Nutrient → S3] Failed", { status: res.status, body: text });
    throw new Error(`Nutrient S3 upload failed: ${res.status} ${text}`);
  }

  const result = await res.json();
  console.log("[Nutrient → S3] Success → ZIP uploaded directly to S3", result);

  const zipUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: zipKey,
    }),
    { expiresIn: 3600 }
  );

  return {
    zipKey,
    zipUrl,
    pageCount: result.page_count ?? result.pageCount ?? 0,
    renderedAt: new Date().toISOString(),
  };
}