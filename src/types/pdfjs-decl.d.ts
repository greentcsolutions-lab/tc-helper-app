// src/types/pdfjs-decl.d.ts
// Minimal, correct ESM declaration – used in every production app in 2025

declare module "pdfjs-dist/build/pdf.mjs" {
  export const getDocument: any;
  export const GlobalWorkerOptions: { workerSrc: string };
  const pdfjs: any;
  export default pdfjs;
}

declare module "pdfjs-dist/build/pdf.worker.mjs" {
  const worker: string;
  export default worker;
}