# TC Helper — PDF extraction & preview

A small app to extract structured data from PDFs (primarily real estate contracts) using Mistral AI. Focused on privacy-first processing: PDFs are uploaded directly, temporary images may be sent to Mistral for extraction, and PDFs/derived images are deleted immediately after extraction. The only data retained is the extracted data the user chooses to keep.

## Key points

- Extraction: Uses Mistral AI via direct PDF upload → temporary images → extraction.
- Privacy: Uploaded PDFs and any derived images are deleted immediately after extraction (typically within ~90s). Extracted JSON and user-saved artifacts are retained only so users can interact with them and can be deleted by users at any time.
- Secure previews: Client no longer runs pdfjs on untrusted PDFs. Previews are rendered server-side to PNG (pdftoppm / poppler) and served as images — removes JS-in-PDF attack surface.
- Preview API: /api/parse/preview/[parseId]?page={n}&scale={px} — returns PNG preview for a single page. Authenticated and restricted to critical pages; responses are cached with TTL.
- Tech stack: Next.js (app router), Prisma, Clerk for auth, Node.js runtime.

## Development

Prerequisites
- Node.js (18+ recommended)
- pnpm / npm
- poppler utilities (pdftoppm):
  - Linux: sudo apt-get install poppler-utils
  - Mac: brew install poppler

Setup
1. Install dependencies
   - pnpm install  # or npm install
2. Configure environment variables (examples)
   - DATABASE_URL
   - CLERK_ISSUER, CLERK_SECRET, etc.
   - MISTRAL_API_KEY
   - STORAGE credentials (where PDFs are uploaded)
3. Run locally
   - pnpm dev  # or npm run dev

Notes
- Ensure pdftoppm is available in the runtime (server / container) for preview generation.
- The preview route enforces size limits and authentication and caches generated PNGs to reduce repeated processing.
- Consider pre-generating thumbnails on upload for faster UX and to avoid rendering pressure at view time.

## Security & operational guidance

- Do not render untrusted PDFs in the browser. Server-side PNG rendering prevents embedded PDF JS from executing in the client.
- Apply rate limits, maximum file-size checks, and auth checks to preview and ingestion endpoints.
- Monitor dependencies related to PDF processing for security advisories; prefer server-side sanitization and rendering.

## Contributing & contact

Found a bug or want to improve behavior? Open an issue or submit a PR.

For privacy or data deletion requests: info@tchelper.app

License: See LICENSE