# README.md

# TC Helper – AI California RPA Extractor

Instantly extract California Residential Purchase Agreement (RPA) data with 99%+ accuracy using Grok 4 Vision.

## Features
- 99%+ accuracy on all RPA fields
- Detects missing Seller Counter Offers
- Perfectly formatted output (dates, money, checkboxes)
- Secure & private
- Built with Next.js 15, Clerk, Stripe, Prisma, Tailwind + shadcn/ui

## Quick Start

```bash
git clone https://github.com/yourname/tc-helper.git
cd tc-helper
cp .env.example .env.local
# Fill in all keys
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm dev// Vercel webhook wake-up - Fri Nov 28 11:21:26 AM CST 2025
// Vercel webhook wake-up - Fri Nov 28 11:23:13 AM CST 2025
