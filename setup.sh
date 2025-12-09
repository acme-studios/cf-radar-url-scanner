#!/bin/bash

# RadarScan Setup Script
# This script sets up the entire Cloudflare Workers environment

set -e  # Exit on error

echo "🚀 RadarScan Setup Script"
echo "=========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .dev.vars exists
if [ ! -f ".dev.vars" ]; then
    echo -e "${RED}❌ Error: .dev.vars file not found${NC}"
    echo "Please create .dev.vars with the following content:"
    echo ""
    echo "CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "CLOUDFLARE_API_TOKEN=your_api_token"
    echo "RESEND_API_KEY=your_resend_key"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} Found .dev.vars file"

# Load environment variables from .dev.vars
export $(grep -v '^#' .dev.vars | xargs)

# Validate required variables
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$RESEND_API_KEY" ]; then
    echo -e "${RED}❌ Error: Missing required environment variables in .dev.vars${NC}"
    echo "Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, RESEND_API_KEY"
    exit 1
fi

echo -e "${GREEN}✓${NC} Environment variables loaded"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Step 2: Create D1 Database
echo "🗄️  Step 2: Creating D1 database..."
if npx wrangler d1 list | grep -q "radar-scanner-db"; then
    echo -e "${YELLOW}⚠${NC}  D1 database 'radar-scanner-db' already exists"
else
    npx wrangler d1 create radar-scanner-db
    echo -e "${GREEN}✓${NC} D1 database created"
    echo -e "${YELLOW}⚠${NC}  Please update wrangler.jsonc with the database_id from above"
    read -p "Press enter after updating wrangler.jsonc..."
fi
echo ""

# Step 3: Apply D1 schema
echo "🔄 Step 3: Applying D1 schema..."
npx wrangler d1 execute radar-scanner-db --file=./migrations/schema.sql
echo -e "${GREEN}✓${NC} D1 schema applied"
echo ""

# Step 4: Create R2 Bucket
echo "☁️  Step 4: Creating R2 bucket..."
if npx wrangler r2 bucket list | grep -q "radar-scan-reports"; then
    echo -e "${YELLOW}⚠${NC}  R2 bucket 'radar-scan-reports' already exists"
else
    npx wrangler r2 bucket create radar-scan-reports
    echo -e "${GREEN}✓${NC} R2 bucket created"
fi
echo ""

# Step 5: Upload secrets to Wrangler
echo "🔐 Step 5: Uploading secrets to Wrangler..."

echo "Uploading CLOUDFLARE_API_TOKEN..."
echo "$CLOUDFLARE_API_TOKEN" | npx wrangler secret put CLOUDFLARE_API_TOKEN

echo "Uploading RESEND_API_KEY..."
echo "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY

echo -e "${GREEN}✓${NC} Secrets uploaded"
echo ""

# Step 6: Deploy Durable Objects
echo "🔧 Step 6: Deploying Durable Objects..."
npx wrangler deploy
echo -e "${GREEN}✓${NC} Durable Objects deployed"
echo ""

# Step 7: Verify setup
echo "✅ Step 7: Verifying setup..."
echo ""
echo "Checking D1 database..."
npx wrangler d1 execute radar-scanner-db --command="SELECT name FROM sqlite_master WHERE type='table';"
echo ""

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update wrangler.jsonc vars.APP_URL with your custom domain"
echo "2. Run 'npm run dev' to start local development"
echo "3. Run 'npm run deploy' to deploy to production"
echo ""
echo "📚 Documentation: See README.md for more details"
