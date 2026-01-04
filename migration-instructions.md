# How to Run Production Database Migration

## Option 1: Via Vercel CLI (Recommended)
```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Run migration
npx prisma migrate deploy
```

## Option 2: Generate Migration SQL (Manual)
```bash
# Generate the migration SQL file
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql

# Then run this SQL directly on your production database
```

## Option 3: Via Prisma Studio
1. Connect to production database
2. Run the migration SQL manually

## What This Creates:
- tasks table
- user_task_templates table  
- Adds customTaskCount to users table
- Adds tasks relation to parse table

After running the migration, redeploy or restart your Vercel deployment.
