// @vitest-environment node
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { handleApiError } from '@/lib/api/error-handler';
import { ValidationError, NotFoundError, DatabaseError } from '@/lib/errors';
import type { ApiResponse } from '@/lib/types';

async function readError(response: Response) {
  const body = (await response.json()) as ApiResponse;
  expect(body.error).toBeDefined();
  return body.error!;
}

// Feature: dokploy-migration
// Property 3: API Error Response Format
// Validates: Requirements 2.3
describe('属性测试: API 错误响应格式', () => {
  it('ValidationError 返回 400 且包含标准错误字段', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 80 }), async (message) => {
        const response = handleApiError(new ValidationError(message));
        const error = await readError(response);

        expect(response.status).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.message).toBe(message);
      }),
      { numRuns: 25 },
    );
  });

  it('NotFoundError 返回 404 且包含标准错误字段', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), (id) => {
        const response = handleApiError(new NotFoundError('resource', id));
        return readError(response).then((error) => {
          expect(response.status).toBe(404);
          expect(error.code).toBe('NOT_FOUND');
          expect(error.message).toContain(id);
        });
      }),
      { numRuns: 25 },
    );
  });

  it('DatabaseError 返回 500 且错误代码为 DATABASE_ERROR', async () => {
    const response = handleApiError(new DatabaseError('db down'));
    const error = await readError(response);

    expect(response.status).toBe(500);
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.message).toBe('Database operation failed');
  });

  it('未知错误返回 500 且包含 code 与 message 字符串', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 120 }), async (message) => {
        const response = handleApiError(new Error(message));
        const error = await readError(response);

        expect(response.status).toBe(500);
        expect(typeof error.code).toBe('string');
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.message).toBe(message);
      }),
      { numRuns: 25 },
    );
  });
});


