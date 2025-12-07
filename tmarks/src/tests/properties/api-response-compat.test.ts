// @vitest-environment node
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  badRequest,
  internalError,
  notFound,
  success,
  unauthorized,
} from '@/lib/api/response';
import type { ApiResponse } from '@/lib/types';

async function readJson(res: Response): Promise<ApiResponse> {
  const body = (await res.json()) as ApiResponse;
  return body;
}

// Feature: dokploy-migration
// Property 4: API Response Compatibility
// Validates: Requirements 2.4
describe('属性测试: API 响应兼容性', () => {
  it('success 响应只包含 data，保留 meta，且无 error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.object(),
          meta: fc.option(
            fc.record({
              page: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
              page_size: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
              total: fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }),
              next_cursor: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
              count: fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }),
            }),
            { nil: undefined },
          ),
        }),
        async ({ data, meta }) => {
          const res = success(data, meta ?? undefined);
          const json = await readJson(res);
          const normalizedData = JSON.parse(JSON.stringify(data));
          expect(json.data).toEqual(normalizedData);
          if (meta) {
            const normalizedMeta = JSON.parse(JSON.stringify(meta));
            expect(json.meta).toEqual(normalizedMeta);
          }
          expect(json.error).toBeUndefined();
        },
      ),
      { numRuns: 25 },
    );
  });

  it('错误响应只包含 error，data 为空且 code/message 保留', async () => {
    const cases = [
      { res: badRequest('x'), status: 400, code: 'BAD_REQUEST' },
      { res: unauthorized('no'), status: 401, code: 'UNAUTHORIZED' },
      { res: notFound('miss'), status: 404, code: 'NOT_FOUND' },
      { res: internalError('fail'), status: 500, code: 'INTERNAL_ERROR' },
    ];

    for (const { res, status, code } of cases) {
      const json = await readJson(res);
      expect(res.status).toBe(status);
      expect(json.error?.code).toBe(code);
      expect(typeof json.error?.message).toBe('string');
      expect(json.data).toBeUndefined();
    }
  });
});


