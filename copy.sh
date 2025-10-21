#!/bin/bash

# Usage: ./copy.sh old-bucket new-bucket

set -a
source .env
set +a

export AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$R2_SECRET_KEY

R2_ENDPOINT_CLEAN=$(echo $R2_ENDPOINT | sed 's:/v2u-assets::')

# Create a temp directory for downloads
TMPDIR=$(mktemp -d)

# List all objects in the source bucket
aws s3 ls s3://$1 --recursive --endpoint-url "$R2_ENDPOINT_CLEAN" | awk '{print $4}' | while read key; do
  # Download each file
  aws s3 cp "s3://$1/$key" "$TMPDIR/$key" --endpoint-url "$R2_ENDPOINT_CLEAN"
  # Upload to new bucket
  aws s3 cp "$TMPDIR/$key" "s3://$2/$key" --endpoint-url "$R2_ENDPOINT_CLEAN"
done

# Clean up
rm -rf "$TMPDIR"