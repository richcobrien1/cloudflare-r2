#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: ./up-m.sh <source-file-path>"
  exit 1
fi

# Load .env
export $(grep -v '^#' .env | xargs)

# Normalize Windows path → Unix path
SRC=$(echo "$1" | sed 's#\\#/#g')

# Extract base filename
BASENAME=$(basename "$SRC")

# Slugify: lowercase, replace spaces/commas with dashes, strip unsafe chars
SLUG=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g')

# Add date prefix
DATE=$(date +%Y/%m/%d)

# Add short hash for uniqueness
HASH=$(sha1sum <<<"$BASENAME$(date +%s)" | cut -c1-8)

# Final object key
KEY="$DATE/${SLUG%.*}-$HASH.${SLUG##*.}"

# Upload
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
aws --endpoint-url "https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com" \
  s3 cp "$SRC" "s3://public/$KEY" --acl public-read

# Public URL
URL="https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com/public/$KEY"

# Output JSON for automation
cat <<EOF
{
  "bucket": "public",
  "filename": "$BASENAME",
  "key": "$KEY",
  "url": "$URL"
}
EOF