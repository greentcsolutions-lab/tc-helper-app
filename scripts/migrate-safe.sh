#!/bin/bash
# Safe Database Migration Script
# This script applies the timelineDataStructured migration without losing data

echo "========================================="
echo "Safe Database Migration for Timeline Feature"
echo "========================================="
echo ""
echo "This migration will:"
echo "  ✓ Add the 'timelineDataStructured' column to the 'parses' table"
echo "  ✓ Preserve ALL existing data"
echo "  ✓ Not drop any tables or columns"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Migration cancelled."
    exit 1
fi

echo ""
echo "Running migration..."
echo ""

# Apply the migration
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Migration completed successfully!"
    echo ""
    echo "Generating Prisma Client..."
    npx prisma generate
    echo ""
    echo "✓ All done! Your database is now up to date."
else
    echo ""
    echo "✗ Migration failed. Please check the error messages above."
    exit 1
fi
