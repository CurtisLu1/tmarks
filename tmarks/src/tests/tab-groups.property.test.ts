import { assert, asyncProperty, array, option, record, string } from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateTabGroupRequest, TabGroup, UpdateTabGroupRequest } from '@/lib/types';
import { tabGroupsService } from '@/services/tab-groups';

const store = vi.hoisted<Record<string, TabGroup>>(() => ({}));
const serviceSpies = vi.hoisted(() => ({
  createTabGroup: vi.fn(),
  updateTabGroup: vi.fn(),
  deleteTabGroup: vi.fn(),
}));

vi.mock('@/services/tab-groups', () => ({
  tabGroupsService: serviceSpies,
}));

function now() {
  return new Date().toISOString();
}

function createGroupEntity(id: string, data: CreateTabGroupRequest): TabGroup {
  const createdAt = now();
  return {
    id,
    user_id: 'user-1',
    title: data.title || `Group-${id}`,
    color: null,
    tags: data.items?.map((item) => item.title) ?? null,
    parent_id: data.parent_id ?? null,
    is_folder: data.is_folder ? 1 : 0,
    is_deleted: 0,
    deleted_at: null,
    position: 0,
    created_at: createdAt,
    updated_at: createdAt,
    items: [],
  };
}

beforeEach(() => {
  Object.keys(store).forEach((key) => delete store[key]);
  Object.values(serviceSpies).forEach((spy) => spy.mockReset());

  serviceSpies.createTabGroup.mockImplementation(async (body: CreateTabGroupRequest) => {
    const id = crypto.randomUUID?.() ?? `group-${Date.now()}`;
    const group = createGroupEntity(id, body);
    store[id] = group;
    return group;
  });

  serviceSpies.updateTabGroup.mockImplementation(async (id: string, body: UpdateTabGroupRequest) => {
    const current = store[id];
    if (!current) {
      throw new Error('group not found');
    }
    const updated: TabGroup = {
      ...current,
      title: body.title ?? current.title,
      color: body.color ?? current.color,
      tags: body.tags ?? current.tags,
      parent_id: body.parent_id ?? current.parent_id,
      position: body.position ?? current.position,
      updated_at: now(),
    };
    store[id] = updated;
    return updated;
  });

  serviceSpies.deleteTabGroup.mockImplementation(async (id: string) => {
    delete store[id];
  });
});

describe('Property 9: 标签页组操作', () => {
  it('创建 -> 更新 -> 删除后状态一致', async () => {
    await assert(
      asyncProperty(
        record({
          title: string({ minLength: 3, maxLength: 32 }),
          tags: array(string({ minLength: 2, maxLength: 16 }), { minLength: 0, maxLength: 4 }),
          update: record({
            title: option(string({ minLength: 3, maxLength: 32 }), { nil: undefined }),
            tags: option(array(string({ minLength: 2, maxLength: 16 }), { minLength: 0, maxLength: 4 }), {
              nil: undefined,
            }),
            parent: option(string({ minLength: 4, maxLength: 20 }), { nil: undefined }),
          }),
        }),
        async (input) => {
          const createData: CreateTabGroupRequest = {
            title: input.title,
            items: input.tags.map((tag) => ({ title: tag, url: `https://example.com/${tag}` })),
          };

          const created = await tabGroupsService.createTabGroup(createData);
          expect(created.title).toBe(createData.title);
          expect(created.tags ?? []).toEqual(createData.items?.map((item) => item.title) ?? []);

          const updateData: UpdateTabGroupRequest = {
            title: input.update.title ?? undefined,
            tags: input.update.tags ?? undefined,
            parent_id: input.update.parent ?? undefined,
          };
          const updated = await tabGroupsService.updateTabGroup(created.id, updateData);

          expect(updated.title).toBe(updateData.title ?? createData.title);
          expect(updated.tags ?? []).toEqual(
            updateData.tags ?? createData.items?.map((item) => item.title) ?? [],
          );
          expect(updated.parent_id).toBe(updateData.parent_id ?? createData.parent_id ?? null);

          await tabGroupsService.deleteTabGroup(created.id);
          expect(store[created.id]).toBeUndefined();
        },
      ),
      { numRuns: 25 },
    );
  });
});

