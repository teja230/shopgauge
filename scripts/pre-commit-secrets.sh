#!/bin/bash

# pre-commit-secrets.sh
# Scans staged files for potential secrets before allowing commits.
# Prevents accidental exposure of API keys, tokens, passwords, and .env files.
#
# Skip with: SKIP_SECRET_CHECK=1 git commit -m "..."

set -e

# Allow bypassing for legitimate cases
if [ "$SKIP_SECRET_CHECK" = "1" ]; then
    echo "[secret-check] Skipped (SKIP_SECRET_CHECK=1)"
    exit 0
fi

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

FAILED=0

# Get list of staged files (excluding deleted files)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=d 2>/dev/null)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

echo "[secret-check] Scanning staged files for secrets..."

# --- Check 1: Block .env files (except .env.example) ---
ENV_FILES=$(echo "$STAGED_FILES" | grep -E '\.env($|\.)' | grep -v '\.env\.example' | grep -v '\.env\..*\.example' || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}BLOCKED: .env file(s) staged for commit:${NC}"
    echo "$ENV_FILES" | while read -r f; do echo "  - $f"; done
    FAILED=1
fi

# --- Check 2: Block cookies.txt ---
COOKIE_FILES=$(echo "$STAGED_FILES" | grep -i 'cookies\.txt' || true)
if [ -n "$COOKIE_FILES" ]; then
    echo -e "${RED}BLOCKED: cookies.txt file(s) staged for commit:${NC}"
    echo "$COOKIE_FILES" | while read -r f; do echo "  - $f"; done
    FAILED=1
fi

# --- Check 3: Block private key files ---
KEY_FILES=$(echo "$STAGED_FILES" | grep -E '\.(pem|key|p12|jks|pfx)$' || true)
if [ -n "$KEY_FILES" ]; then
    echo -e "${RED}BLOCKED: Private key/certificate file(s) staged for commit:${NC}"
    echo "$KEY_FILES" | while read -r f; do echo "  - $f"; done
    FAILED=1
fi

# --- Check 4: Scan file contents for secret patterns ---
# Only scan text files, skip binaries and large files
for file in $STAGED_FILES; do
    # Skip files that don't exist (submodules, etc.)
    [ -f "$file" ] || continue

    # Skip binary files
    if file "$file" | grep -qE 'binary|executable|image|archive'; then
        continue
    fi

    # Skip known safe files
    case "$file" in
        *.md|*.txt|*.lock|*.svg|*.png|*.jpg|*.gif|*.ico|*.woff*|*.ttf|*.eot)
            continue
            ;;
    esac

    # Get staged content (not working directory content)
    CONTENT=$(git show ":$file" 2>/dev/null) || continue

    # JWT tokens (eyJ... base64 encoded JSON header)
    if echo "$CONTENT" | grep -qE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'; then
        # Allow references to JWT format in docs/comments, block actual tokens
        MATCHES=$(echo "$CONTENT" | grep -nE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' | grep -v '^\s*//' | grep -v '^\s*\*' | grep -v '^\s*#' | head -3)
        if [ -n "$MATCHES" ]; then
            echo -e "${RED}BLOCKED: Possible JWT token in ${file}:${NC}"
            echo "$MATCHES" | while read -r line; do echo "  $line"; done
            FAILED=1
        fi
    fi

    # Shopify tokens (shpat_, shpss_, shpca_, shppa_)
    if echo "$CONTENT" | grep -qE 'shp(at|ss|ca|pa)_[a-fA-F0-9]{32,}'; then
        echo -e "${RED}BLOCKED: Shopify token found in ${file}${NC}"
        FAILED=1
    fi

    # OpenAI API keys (sk-...)
    if echo "$CONTENT" | grep -qE 'sk-[a-zA-Z0-9]{40,}'; then
        echo -e "${RED}BLOCKED: OpenAI API key found in ${file}${NC}"
        FAILED=1
    fi

    # AWS access keys (AKIA...)
    if echo "$CONTENT" | grep -qE 'AKIA[0-9A-Z]{16}'; then
        echo -e "${RED}BLOCKED: AWS access key found in ${file}${NC}"
        FAILED=1
    fi

    # Slack tokens (xoxb-, xoxp-, xoxs-)
    if echo "$CONTENT" | grep -qE 'xox[bps]-[0-9a-zA-Z-]{20,}'; then
        echo -e "${RED}BLOCKED: Slack token found in ${file}${NC}"
        FAILED=1
    fi

    # GitHub tokens (ghp_, github_pat_)
    if echo "$CONTENT" | grep -qE '(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{80,})'; then
        echo -e "${RED}BLOCKED: GitHub token found in ${file}${NC}"
        FAILED=1
    fi

    # SendGrid API keys (SG....)
    if echo "$CONTENT" | grep -qE 'SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}'; then
        echo -e "${RED}BLOCKED: SendGrid API key found in ${file}${NC}"
        FAILED=1
    fi

    # Private keys in file content
    if echo "$CONTENT" | grep -qE 'BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY'; then
        echo -e "${RED}BLOCKED: Private key found in ${file}${NC}"
        FAILED=1
    fi

    # Generic high-value secret assignments (key/secret/token/password = "long_value")
    # Only flag in code files, not configs that use ${VAR} patterns
    case "$file" in
        *.java|*.ts|*.tsx|*.js|*.jsx|*.py|*.rb|*.go)
            SUSPICIOUS=$(echo "$CONTENT" | grep -nE '(password|secret|token|api.?key)\s*[:=]\s*"[a-zA-Z0-9+/=_-]{32,}"' | grep -vi 'dummy\|placeholder\|example\|test\|TODO\|CHANGE' | head -3)
            if [ -n "$SUSPICIOUS" ]; then
                echo -e "${YELLOW}WARNING: Possible hardcoded secret in ${file}:${NC}"
                echo "$SUSPICIOUS" | while read -r line; do echo "  $line"; done
                FAILED=1
            fi
            ;;
    esac
done

if [ $FAILED -ne 0 ]; then
    echo ""
    echo -e "${RED}Commit blocked: potential secrets detected.${NC}"
    echo -e "Review the findings above. If these are false positives, bypass with:"
    echo -e "  ${YELLOW}SKIP_SECRET_CHECK=1 git commit -m \"...\"${NC}"
    exit 1
fi

echo -e "${GREEN}[secret-check] No secrets detected.${NC}"
exit 0
