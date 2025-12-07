import fs from 'fs/promises';
import path from 'path';
import { StorageProvider, UploadOptions, UploadResult } from './interface';

export interface LocalStorageOptions {
  basePath?: string;
  publicUrl?: string;
}

export class LocalStorage implements StorageProvider {
  private readonly basePath: string;
  private readonly publicUrl: string;

  constructor(options: LocalStorageOptions = {}) {
    this.basePath = options.basePath ?? process.env.STORAGE_PATH ?? './storage';
    this.publicUrl = options.publicUrl ?? process.env.STORAGE_PUBLIC_URL ?? '/storage';
  }

  async upload(key: string, data: Buffer | ArrayBuffer, _options?: UploadOptions): Promise<UploadResult> {
    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await fs.writeFile(filePath, buffer);

    return {
      key,
      url: `${this.publicUrl}/${key}`,
      size: buffer.length,
    };
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.basePath, key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.basePath, key));
    } catch {
      // ignore missing
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    return `${this.publicUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.basePath, key));
      return true;
    } catch {
      return false;
    }
  }
}

