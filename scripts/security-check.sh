#!/bin/bash
# Security audit script for MENS CATALY
# Checks for vulnerable dependencies and leaked secrets

set -e

echo "=== Security Audit ==="
echo ""

# 1. npm audit for vulnerable dependencies
echo "[1/3] Running npm audit..."
npm audit --audit-level=moderate || {
  echo "WARNING: npm audit found vulnerabilities at moderate+ level"
  # Don't exit — report but continue other checks
}

echo ""

# 2. Check for .env files tracked in git
echo "[2/3] Checking for tracked .env files..."
if git ls-files --cached | grep -E '\.env$|\.env\.local$|\.env\.development\.local$|\.env\.test\.local$|\.env\.production\.local$'; then
  echo "ERROR: .env file tracked in git — remove it immediately"
  exit 1
fi
echo "OK: No .env files tracked in git"

echo ""

# 3. Check for common secret patterns in tracked files
echo "[3/3] Checking for potential secrets in source code..."
SECRETS_FOUND=0

# Check for hardcoded API keys (skip test/mock files and .env.example)
if git ls-files --cached | grep -v -E '(\.env\.example|__tests__|test/|\.test\.|\.spec\.)' | xargs grep -l -E '(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36})' 2>/dev/null; then
  echo "WARNING: Potential hardcoded secrets found in tracked files"
  SECRETS_FOUND=1
fi

if [ "$SECRETS_FOUND" -eq 0 ]; then
  echo "OK: No potential secrets detected"
fi

echo ""
echo "=== Security Audit Complete ==="
