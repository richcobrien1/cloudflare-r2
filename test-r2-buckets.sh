#!/bin/bash
# Test script for Cloudflare R2 public and private buckets using AWS CLI
# Reads credentials and endpoint from .env file in the same directory

set -e

# Load .env if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Required env vars: R2_ACCESS_KEY, R2_SECRET_KEY, R2_ACCOUNT_ID, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET
if [[ -z "$R2_ACCESS_KEY" || -z "$R2_SECRET_KEY" || -z "$R2_ACCOUNT_ID" ]]; then
  echo "Missing R2 credentials or account ID in .env"
  exit 1
fi

ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"

PUBLIC_BUCKET="${R2_PUBLIC_BUCKET:-public}"
PRIVATE_BUCKET="${R2_PRIVATE_BUCKET:-private}"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_KEY"

# List contents of public bucket
echo "🔹 Listing contents of public bucket ($PUBLIC_BUCKET):"
aws --endpoint-url="$ENDPOINT" s3 ls s3://$PUBLIC_BUCKET/

# List contents of private bucket
echo "🔹 Listing contents of private bucket ($PRIVATE_BUCKET):"
aws --endpoint-url="$ENDPOINT" s3 ls s3://$PRIVATE_BUCKET/

# Download a test file from public bucket
echo "🔹 Downloading test-public.txt from public bucket (if exists):"
aws --endpoint-url="$ENDPOINT" s3 cp s3://$PUBLIC_BUCKET/test-public.txt ./test-public.txt || echo "File not found."

# Download a test file from private bucket
echo "🔹 Downloading test-private.txt from private bucket (if exists):"
aws --endpoint-url="$ENDPOINT" s3 cp s3://$PRIVATE_BUCKET/test-private.txt ./test-private.txt || echo "File not found."

# Clean up AWS env vars
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
