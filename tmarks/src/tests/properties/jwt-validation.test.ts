// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateJWT, verifyJWT } from '@/lib/jwt';

// Feature: dokploy-migration
// Property 2: JWT Validation Correctness
// Validates: Requirements 2.2
describe('属性测试: JWT 验证正确性', () => {
  const secret = 'test-secret-at-least-32-characters-long';

  it('接受使用正确密钥签名且未过期的 token', async () => {
    const token = await generateJWT({ sub: 'user-123', session_id: 'session-456' }, secret, '1h');
    const payload = await verifyJWT(token, secret);
    expect(payload.sub).toBe('user-123');
    expect(payload.session_id).toBe('session-456');
  });

  it('拒绝已过期的 token', async () => {
    const token = await generateJWT({ sub: 'user-expired' }, secret, '0s');
    await expect(verifyJWT(token, secret)).rejects.toThrow();
  });

  it('拒绝使用错误密钥的 token', async () => {
    const token = await generateJWT({ sub: 'user-wrong-secret' }, secret, '1h');
    await expect(verifyJWT(token, 'wrong-secret')).rejects.toThrow();
  });
});

