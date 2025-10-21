#!/usr/bin/env bash
set -euo pipefail

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Use local jq
JQ="./jq.exe"

# Create new R2 access key
echo "== Creating new R2 access key =="
response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/access-keys" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json")

# Extract keys
ACCESS_KEY_ID=$(echo "$response" | $JQ -r '.result.access_key_id')
SECRET_ACCESS_KEY=$(echo "$response" | $JQ -r '.result.secret_access_key')

if [[ "$ACCESS_KEY_ID" == "null" || "$SECRET_ACCESS_KEY" == "null" ]]; then
  echo "ERROR: Failed to create R2 access key"
  echo "$response" | $JQ '.'
  exit 1
fi

echo "== Updating Worker secrets =="
npx wrangler secret put R2_ACCESS_KEY_ID --env production <<< "$ACCESS_KEY_ID"
npx wrangler secret put R2_SECRET_ACCESS_KEY --env production <<< "$SECRET_ACCESS_KEY"

echo "✅ R2 token rotated and secrets updated"