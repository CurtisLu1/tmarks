/**
 * TMarks API - 用户和搜索模块
 * 用户信息和全局搜索功能
 */

import { TMarksClient } from './client';
import type {
  GetUserResponse,
  SearchParams,
  SearchResponse,
  GetPreferencesResponse,
} from './types';

export class UserAPI extends TMarksClient {
  /**
   * 获取当前用户信息
   * GET /api/me
   */
  async getMe(): Promise<GetUserResponse> {
    return this.get<GetUserResponse>('/me');
  }

  /**
   * 获取用户偏好设置
   * GET /api/v1/preferences
   */
  async getPreferences(): Promise<GetPreferencesResponse> {
    return this.get<GetPreferencesResponse>('/preferences');
  }

  /**
   * 获取快照相关设置
   */
  async getSnapshotSettings(): Promise<{
    autoCreate: boolean;
    autoDedupe: boolean;
    retentionCount: number;
  }> {
    const response = await this.getPreferences();
    const prefs = response.data.preferences;
    return {
      autoCreate: prefs.snapshot_auto_create,
      autoDedupe: prefs.snapshot_auto_dedupe,
      retentionCount: prefs.snapshot_retention_count,
    };
  }

  /**
   * 全局搜索
   * GET /api/search
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    return this.get<SearchResponse>('/search', params);
  }

  // ============ 辅助方法 ============

  /**
   * 快速搜索（使用默认限制）
   */
  async quickSearch(query: string): Promise<SearchResponse> {
    return this.search({ q: query, limit: 20 });
  }

  /**
   * 获取用户统计信息
   */
  async getStats(): Promise<GetUserResponse['data']['user']['stats']> {
    const response = await this.getMe();
    return response.data.user.stats;
  }

  /**
   * 检查 API Key 是否有效
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getMe();
      return true;
    } catch (error) {
      return false;
    }
  }
}

