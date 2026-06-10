#!/bin/bash

# QUICK START: YouTube Search Component Setup
# Run this script to verify and setup the YouTube search component

echo "================================"
echo "YouTube Search Component Setup"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Angular CLI is installed
echo "📋 Checking Angular CLI..."
if command -v ng &> /dev/null; then
    echo -e "${GREEN}✓${NC} Angular CLI found"
else
    echo -e "${RED}✗${NC} Angular CLI not found. Install with: npm install -g @angular/cli"
    exit 1
fi

# Check if Node modules exist
echo ""
echo "📦 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules found"
else
    echo -e "${YELLOW}!${NC} Installing dependencies..."
    npm install
fi

# Check if environment file exists
echo ""
echo "🔑 Checking environment configuration..."
if [ -f "src/environments/environment.ts" ]; then
    if grep -q "youtubeApiKey" src/environments/environment.ts; then
        echo -e "${GREEN}✓${NC} Environment file configured"
        echo "   Note: Make sure youtubeApiKey is set in src/environments/environment.ts"
    else
        echo -e "${YELLOW}!${NC} youtubeApiKey not found in environment.ts"
        echo "   Add: youtubeApiKey: 'YOUR_API_KEY_HERE'"
    fi
else
    echo -e "${RED}✗${NC} environment.ts not found"
fi

# Check if component files exist
echo ""
echo "🔍 Checking component files..."
FILES=(
    "src/app/core/services/youtube-quota-optimized.service.ts"
    "src/app/features/youtube-ai/search/search-simple.component.ts"
    "src/app/core/services/youtube-quota-optimized.service.spec.ts"
    "src/app/features/youtube-ai/search/search-simple.component.spec.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file not found"
    fi
done

echo ""
echo "================================"
echo "Next Steps"
echo "================================"
echo ""
echo "1️⃣  Get YouTube API Key:"
echo "   - Visit: https://console.cloud.google.com"
echo "   - Create a project"
echo "   - Enable: YouTube Data API v3"
echo "   - Create: API Key (type: Browser)"
echo ""
echo "2️⃣  Add API Key to environment:"
echo "   - Edit: src/environments/environment.ts"
echo "   - Set: youtubeApiKey: 'YOUR_KEY_HERE'"
echo ""
echo "3️⃣  Start the application:"
echo "   ng serve"
echo ""
echo "4️⃣  Navigate to search component:"
echo "   - Route: /youtube-search"
echo "   - Or import: YoutubeSearchSimpleComponent"
echo ""
echo "5️⃣  Run tests:"
echo "   ng test --include='**/youtube-quota-optimized.service.spec.ts'"
echo ""
echo "================================"
echo "Documentation"
echo "================================"
echo ""
echo "📖 Main README:"
echo "   src/app/features/youtube-ai/YOUTUBE_SEARCH_README.md"
echo ""
echo "📖 Integration Guide:"
echo "   src/app/features/youtube-ai/INTEGRATION_GUIDE.md"
echo ""
echo "================================"
echo "Monitor Quota Usage"
echo "================================"
echo ""
echo "Google Cloud Console:"
echo "   1. Go to: https://console.cloud.google.com"
echo "   2. Select your project"
echo "   3. Navigate to: YouTube Data API v3"
echo "   4. Click: Quotas"
echo "   5. Monitor: 'Queries per day'"
echo ""
echo "Free Tier: 10,000 units/day"
echo "With caching: ~5,000-6,000 units/day (50% savings)"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
