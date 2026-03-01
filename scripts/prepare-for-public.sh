#!/bin/bash

# prepare-for-public.sh
# Script to prepare the StoreSight repository for making it public
# This script helps clean git history and verify no secrets are exposed

set -e  # Exit on error

echo "================================================"
echo "StoreSight - Prepare Repository for Public Release"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not a git repository${NC}"
    exit 1
fi

echo "Step 1: Checking for sensitive files in git..."
echo "----------------------------------------------"

# Check if cookies.txt is tracked
if git ls-files | grep -q "cookies.txt"; then
    echo -e "${RED}⚠️  CRITICAL: cookies.txt is tracked in git!${NC}"
    NEEDS_CLEANUP=1
else
    echo -e "${GREEN}✓ cookies.txt is not tracked${NC}"
fi

# Check for .env files in config/
if git ls-files | grep -q "config/\.env$\|config/\.env\."; then
    echo -e "${RED}⚠️  CRITICAL: .env files in config/ are tracked!${NC}"
    NEEDS_CLEANUP=1
else
    echo -e "${GREEN}✓ No .env files tracked in config/${NC}"
fi

# Check for any .env files (except .env.example)
TRACKED_ENV_FILES=$(git ls-files | grep "\.env" | grep -v "\.env\.example" || true)
if [ ! -z "$TRACKED_ENV_FILES" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Found tracked .env files:${NC}"
    echo "$TRACKED_ENV_FILES"
    NEEDS_CLEANUP=1
else
    echo -e "${GREEN}✓ No unexpected .env files tracked${NC}"
fi

echo ""

# Step 2: Check current working directory for secrets
echo "Step 2: Checking working directory for secrets..."
echo "------------------------------------------------"

# Check if config/.env exists and is not in .gitignore
if [ -f "config/.env" ]; then
    if git check-ignore -q config/.env; then
        echo -e "${GREEN}✓ config/.env exists and is properly ignored${NC}"
    else
        echo -e "${YELLOW}⚠️  WARNING: config/.env exists but may not be ignored${NC}"
        echo "   Make sure it's in .gitignore!"
    fi
fi

# Check if cookies.txt exists
if [ -f "cookies.txt" ]; then
    if git check-ignore -q cookies.txt; then
        echo -e "${GREEN}✓ cookies.txt exists and is properly ignored${NC}"
    else
        echo -e "${RED}⚠️  CRITICAL: cookies.txt exists and is NOT ignored!${NC}"
    fi
fi

echo ""

# Step 3: Search for potential hardcoded secrets
echo "Step 3: Scanning for potential hardcoded secrets..."
echo "--------------------------------------------------"

# Search in Java files
echo "Checking Java files..."
SECRET_PATTERNS="password.*=.*['\"][a-zA-Z0-9]{10,}['\"]|secret.*=.*['\"][a-zA-Z0-9]{10,}['\"]|api.*key.*=.*['\"][a-zA-Z0-9]{10,}['\"]"
if find backend/src -name "*.java" -type f -exec grep -iE "$SECRET_PATTERNS" {} + 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Found potential secrets in Java files (review above)${NC}"
else
    echo -e "${GREEN}✓ No obvious secrets in Java files${NC}"
fi

# Search in TypeScript/JavaScript files
echo "Checking TypeScript/JavaScript files..."
if find frontend/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -type f -exec grep -iE "$SECRET_PATTERNS" {} + 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Found potential secrets in TS/JS files (review above)${NC}"
else
    echo -e "${GREEN}✓ No obvious secrets in TypeScript files${NC}"
fi

echo ""

# Step 4: Provide cleanup recommendations
echo "Step 4: Cleanup Recommendations"
echo "-------------------------------"

if [ "$NEEDS_CLEANUP" = "1" ]; then
    echo -e "${RED}"
    echo "⚠️  CRITICAL: Your repository needs cleanup before going public!"
    echo -e "${NC}"
    echo ""
    echo "To clean your git history, run:"
    echo ""
    echo "  # Install BFG Repo Cleaner (recommended)"
    echo "  brew install bfg"
    echo ""
    echo "  # Remove cookies.txt from history"
    echo "  bfg --delete-files cookies.txt"
    echo ""
    echo "  # Remove any .env files from history (except .env.example)"
    echo "  bfg --delete-files '.env' --delete-files '.env.*' --protect-blobs-from main"
    echo ""
    echo "  # Clean up"
    echo "  git reflog expire --expire=now --all"
    echo "  git gc --prune=now --aggressive"
    echo ""
    echo "  # Force push (WARNING: Rewrites history!)"
    echo "  git push origin --force --all"
    echo ""
else
    echo -e "${GREEN}✓ No critical issues found in git tracking${NC}"
fi

echo ""
echo "Step 5: Pre-flight Checklist"
echo "----------------------------"
echo ""
echo "Before making repository public, ensure:"
echo ""
echo "  [ ] Updated .gitignore (run: git add .gitignore && git commit -m 'Update gitignore')"
echo "  [ ] Cleaned git history (if needed above)"
echo "  [ ] No secrets in current commit (verified above)"
echo "  [ ] All sensitive files are in .gitignore"
echo "  [ ] Created SECURITY.md file"
echo "  [ ] Updated README with setup instructions"
echo ""
echo "After making repository public:"
echo ""
echo "  [ ] ⚠️  IMMEDIATELY rotate ALL production credentials"
echo "  [ ] Update all API keys (Shopify, ScrapingDog, Serper, SerpAPI)"
echo "  [ ] Generate new JWT secrets"
echo "  [ ] Change admin password"
echo "  [ ] Regenerate database password"
echo "  [ ] Enable GitHub security features (Dependabot, Secret Scanning)"
echo ""
echo "================================================"
echo "Scan Complete!"
echo "================================================"
