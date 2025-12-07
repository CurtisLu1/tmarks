// @vitest-environment node
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { LocalStorage } from '@/lib/storage/local';

describe('属性测试: Storage Round-Trip', () => {
  it('上传后下载应一致，并可删除', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tmarks-storage-'));
    const storage = new LocalStorage({ basePath: tmp, publicUrl: '/storage' });

    const key = 'test/hello.txt';
    const content = Buffer.from('hello storage');

    const result = await storage.upload(key, content, { contentType: 'text/plain' });
    expect(result.key).toBe(key);
    expect(result.size).toBe(content.length);

    const downloaded = await storage.download(key);
    expect(downloaded?.toString()).toBe(content.toString());

    const url = await storage.getSignedUrl(key);
    expect(url.includes(key)).toBe(true);

    await storage.delete(key);
    const exists = await storage.exists(key);
    expect(exists).toBe(false);
  });
});

