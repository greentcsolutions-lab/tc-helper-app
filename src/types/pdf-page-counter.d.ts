// pdf-page-counter.d.ts (place in src/ or root)
declare module 'pdf-page-counter' {
  interface PdfData {
    numpages: number;
    text?: string;
    // Add other optional fields if you ever use them
  }

  function pdfPageCounter(buffer: Buffer | Uint8Array): Promise<PdfData>;

  export default pdfPageCounter;
}