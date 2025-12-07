#!/usr/bin/env node

/**
 * 准备 Cloudflare Pages 部署
 * 将静态导出内容和 functions 目录合并到同一层级
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const exportDir = path.join(__dirname, '../out');
const functionsDir = path.join(__dirname, '../functions');
const deployDir = path.join(__dirname, '../.deploy');
const compressibleExts = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.svg',
  '.xml',
  '.txt',
  '.wasm',
  '.map',
]);
const skipCompressDirs = new Set(['functions']);
const MIN_COMPRESS_SIZE = 1024; // 1KB 以上再压缩

console.log('🚀 准备Cloudflare Pages部署...');

// 清理旧的部署目录（尝试删除，失败则跳过）
if (fs.existsSync(deployDir)) {
  try {
    fs.rmSync(deployDir, { recursive: true, force: true });
    console.log('✓ 清理旧部署目录');
  } catch (error) {
    console.log('⚠ 无法删除旧目录，将覆盖文件');
  }
}

// 创建部署目录
fs.mkdirSync(deployDir, { recursive: true });

if (!fs.existsSync(exportDir)) {
  throw new Error(`静态导出目录不存在: ${exportDir}，请先运行 next export`);
}

// 复制静态导出内容到部署目录
console.log('📦 复制静态文件...');
copyDir(exportDir, deployDir);

// 复制 functions 目录到部署目录
console.log('⚡ 复制Functions...');
const targetFunctionsDir = path.join(deployDir, 'functions');
copyDir(functionsDir, targetFunctionsDir);

console.log('🗜 压缩静态资源...');
const compressedCount = compressDir(deployDir);
console.log(`✓ 压缩完成（${compressedCount} 个文件生成 .br/.gz）`);

console.log('✅ 部署准备完成!');
console.log(`📁 部署目录: ${deployDir}`);

/**
 * 递归复制目录
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 递归压缩静态文件，生成 .br 和 .gz
 */
function compressDir(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(deployDir, fullPath);
    const topLevelDir = relative.split(path.sep)[0];

    if (skipCompressDirs.has(topLevelDir)) {
      continue;
    }

    if (entry.isDirectory()) {
      count += compressDir(fullPath);
      continue;
    }

    if (!shouldCompress(fullPath)) {
      continue;
    }

    compressFile(fullPath);
    count += 1;
  }

  return count;
}

function shouldCompress(filePath) {
  if (filePath.endsWith('.br') || filePath.endsWith('.gz')) return false;
  const ext = path.extname(filePath).toLowerCase();
  if (!compressibleExts.has(ext)) return false;
  const { size } = fs.statSync(filePath);
  return size >= MIN_COMPRESS_SIZE;
}

function compressFile(filePath) {
  const buffer = fs.readFileSync(filePath);

  const brotli = brotliCompressSync(buffer, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
    },
  });
  fs.writeFileSync(`${filePath}.br`, brotli);

  const gzip = gzipSync(buffer, { level: 9 });
  fs.writeFileSync(`${filePath}.gz`, gzip);
}

