import { StorageProvider } from './interface';
import { LocalStorage } from './local';
import { MinioStorage } from './minio';

export function createStorageProvider(): StorageProvider {
  if (process.env.MINIO_ENDPOINT || process.env.MINIO_ACCESS_KEY) {
    return new MinioStorage();
  }
  return new LocalStorage();
}

export const storage = createStorageProvider();

