#!/usr/bin/env bash
set -euo pipefail

# Load .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Validate required vars
for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ZONE_ID; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set (check .env)" >&2
    exit 2
  fi
done

# Use local jq binary
JQ="./jq.exe"

echo "== Wrangler identity =="
npx wrangler whoami || true

echo "== Local config files =="
[ -f wrangler.toml ] && cat wrangler.toml || echo "wrangler.toml not found"
[ -f wrangler.jsonc ] && cat wrangler.jsonc || echo "wrangler.jsonc not found"

echo "== Zone info for v2u.us =="
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json" | $JQ '.'

echo "== Worker services =="
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/services" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json" | $JQ '.'

echo "== R2 buckets =="
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json" | $JQ '.'

echo "== R2 access keys =="
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/access-keys" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json" | $JQ '.'

echo "== Worker secrets (production) =="
npx wrangler secret list --env production || npx wrangler secret list || true

echo "== DNS lookup r2.v2u.us =="
nslookup r2.v2u.us || true

echo "== HTTPS test r2.v2u.us =="
curl -v --max-time 15 "https://r2.v2u.us/videos/test.txt" || true

echo "== Done =="