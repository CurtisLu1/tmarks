import { randomUUID } from 'crypto';

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKeyRecord {
  id: string;
  key: string;
  key_prefix: string;
  name: string;
  description: string | null;
  permissions: string[];
  status: ApiKeyStatus;
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyLogRecord {
  api_key_id: string;
  user_id: string;
  endpoint: string;
  method: string;
  status: number;
  ip: string | null;
  created_at: string;
}

// In-memory store (sufficient for mock/demo)
const apiKeys: ApiKeyRecord[] = [];
const apiKeyLogs: ApiKeyLogRecord[] = [];

function now(): string {
  return new Date().toISOString();
}

export function listApiKeys() {
  return {
    keys: apiKeys,
    quota: {
      used: apiKeys.length,
      limit: 3,
    },
  };
}

export function getApiKey(id: string): ApiKeyRecord | undefined {
  return apiKeys.find((k) => k.id === id);
}

export function createApiKey(payload: Partial<ApiKeyRecord> & { name?: string; description?: string; permissions?: string[]; expires_at?: string | null }) {
  const key = `sk-${randomUUID().replace(/-/g, '')}`;
  const created_at = now();
  const record: ApiKeyRecord = {
    id: randomUUID(),
    key,
    key_prefix: key.slice(0, 6),
    name: payload.name || 'New API Key',
    description: payload.description ?? null,
    permissions: payload.permissions ?? [],
    status: 'active',
    expires_at: payload.expires_at ?? null,
    last_used_at: null,
    last_used_ip: null,
    created_at,
    updated_at: created_at,
  };
  apiKeys.unshift(record);
  return record;
}

export function updateApiKey(id: string, patch: Partial<ApiKeyRecord>) {
  const existing = getApiKey(id);
  if (!existing) return undefined;
  Object.assign(existing, patch, { updated_at: now() });
  return existing;
}

export function revokeApiKey(id: string) {
  return updateApiKey(id, { status: 'revoked' });
}

export function deleteApiKey(id: string) {
  const idx = apiKeys.findIndex((k) => k.id === id);
  if (idx >= 0) apiKeys.splice(idx, 1);
}

export function listLogs(id: string, limit: number = 10) {
  return apiKeyLogs.filter((log) => log.api_key_id === id).slice(0, limit);
}

