#!/bin/bash
set -e

export AWS_DEFAULT_REGION=eu-central-1

echo "Ініціалізація AWS-сервісів у LocalStack..."

# Створення S3 бакету
awslocal s3 mb s3://shieldcloud-files
awslocal s3api put-bucket-versioning \
  --bucket shieldcloud-files \
  --versioning-configuration Status=Enabled

# Створення KMS ключа
KEY_ID=$(awslocal kms create-key \
  --description "Master key для шифрування файлів" \
  --query 'KeyMetadata.KeyId' \
  --output text)

awslocal kms create-alias \
  --alias-name alias/shieldcloud-key \
  --target-key-id $KEY_ID

# Створення CloudWatch лог-групи
awslocal logs create-log-group \
  --log-group-name /shieldcloud/audit

awslocal logs create-log-stream \
  --log-group-name /shieldcloud/audit \
  --log-stream-name events

echo "Ініціалізація завершена!"
echo "  S3 бакет: shieldcloud-files (versioning enabled)"
echo "  KMS ключ: $KEY_ID (alias: alias/shieldcloud-key)"
echo "  CloudWatch: /shieldcloud/audit"
