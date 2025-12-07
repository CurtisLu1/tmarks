import { Client } from 'minio';
import { StorageProvider, UploadOptions, UploadResult } from './interface';

export interface MinioStorageOptions {
  endPoint?: string;
  port?: number;
  useSSL?: boolean;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  publicUrl?: string;
}

export class MinioStorage implements StorageProvider {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(options: MinioStorageOptions = {}) {
    const endPoint = options.endPoint ?? process.env.MINIO_ENDPOINT ?? 'localhost';
    const port = options.port ?? Number.parseInt(process.env.MINIO_PORT ?? '9000', 10);
    const useSSL = options.useSSL ?? process.env.MINIO_USE_SSL === 'true';
    const accessKey = options.accessKey ?? process.env.MINIO_ACCESS_KEY ?? '';
    const secretKey = options.secretKey ?? process.env.MINIO_SECRET_KEY ?? '';

    this.bucket = options.bucket ?? process.env.MINIO_BUCKET ?? 'tmarks';
    this.publicUrl = options.publicUrl ?? process.env.STORAGE_PUBLIC_URL ?? '';

    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async upload(key: string, data: Buffer | ArrayBuffer, options?: UploadOptions): Promise<UploadResult> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': options?.contentType ?? 'application/octet-stream',
      ...options?.metadata,
    });

    return {
      key,
      url: this.publicUrl ? `${this.publicUrl}/${key}` : key,
      size: buffer.length,
    };
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      const stream = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresIn);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}

