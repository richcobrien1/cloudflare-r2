#!/bin/bash



# R2 API test script for Cloudflare Worker endpoints
PUBLIC_HOST="https://public.v2u.us"
PRIVATE_HOST="https://private.v2u.us"
AUTH="super-secret-key"

echo "🔹 Uploading to public bucket..."
curl -s -o /dev/null -w "HTTP %{http_code} - upload\n" -X PUT \
  -H "Content-Type: text/plain" \
  --data-binary "Hello from public!" \
  "$PUBLIC_HOST/test-public.txt"

echo "🔹 Fetching from public bucket..."
curl -s -o /dev/null -w "HTTP %{http_code} - fetch\n" "$PUBLIC_HOST/test-public.txt"

echo "🔹 Uploading to private bucket (with auth)..."
curl -s -o /dev/null -w "HTTP %{http_code} - upload\n" -X PUT \
  -H "Content-Type: text/plain" \
  -H "X-Auth-Key: $AUTH" \
  --data-binary "Hello from private!" \
  "$PRIVATE_HOST/test-private.txt"

echo "🔹 Fetching from private bucket..."
curl -s -o /dev/null -w "HTTP %{http_code} - fetch\n" "$PRIVATE_HOST/test-private.txt"

echo "🔹 Deleting from private bucket (with auth)..."
curl -s -o /dev/null -w "HTTP %{http_code} - delete\n" -X DELETE \
  -H "X-Auth-Key: $AUTH" \
  "$PRIVATE_HOST/test-private.txt"