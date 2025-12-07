#!/usr/bin/env bash

set -euo pipefail

ENV_FILE=${1:-.env}

if [[ -f "$ENV_FILE" ]]; then
  echo "加载环境变量: $ENV_FILE"
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
else
  echo "未找到 $ENV_FILE，使用当前环境变量"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL 未配置，无法运行数据库迁移" >&2
  exit 1
fi

echo "执行数据库迁移..."
pnpm db:push

echo "确保本地存储路径存在..."
mkdir -p "${STORAGE_PATH:-/app/storage}"

if [[ -n "${MINIO_ENDPOINT:-}" && -n "${MINIO_ACCESS_KEY:-}" && -n "${MINIO_SECRET_KEY:-}" ]]; then
  echo "检查 MinIO bucket: ${MINIO_BUCKET:-tmarks}"
  node --input-type=module <<'NODE'
import { Client } from 'minio';

const endPoint = process.env.MINIO_ENDPOINT ?? 'minio';
const port = Number.parseInt(process.env.MINIO_PORT ?? '9000', 10);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY ?? 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY ?? 'minioadmin';
const bucket = process.env.MINIO_BUCKET ?? 'tmarks';

const client = new Client({ endPoint, port, useSSL, accessKey, secretKey });

async function ensureBucket(): Promise<void> {
  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucket);
    console.log(`已创建 bucket: ${bucket}`);
  } else {
    console.log(`bucket 已存在: ${bucket}`);
  }
}

await ensureBucket();
NODE
else
  echo "MINIO_* 未配置，跳过 bucket 创建"
fi

echo "初始化完成 ✅"

