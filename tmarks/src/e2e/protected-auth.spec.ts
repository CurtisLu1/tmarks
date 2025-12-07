import { test, expect } from '@playwright/test';

test.describe('受保护路由认证检查', () => {
  test('未登录访问受保护路由应跳转登录页', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveURL(/\/login/);
  });
});

