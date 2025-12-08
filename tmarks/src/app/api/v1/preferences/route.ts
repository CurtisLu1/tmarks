import { NextResponse } from 'next/server';
import type { UpdatePreferencesRequest, UserPreferences } from '@/lib/types';

function buildDefaultPreferences(): UserPreferences {
  return {
    user_id: '',
    theme: 'light',
    page_size: 30,
    view_mode: 'list',
    density: 'normal',
    tag_layout: 'grid',
    sort_by: 'popular',
    search_auto_clear_seconds: 15,
    tag_selection_auto_clear_seconds: 30,
    enable_search_auto_clear: true,
    enable_tag_selection_auto_clear: false,
    default_bookmark_icon: 'orbital-spinner',
    snapshot_retention_count: 5,
    snapshot_auto_create: false,
    snapshot_auto_dedupe: true,
    snapshot_auto_cleanup_days: 0,
    updated_at: new Date().toISOString(),
  };
}

let preferencesState: UserPreferences | null = null;

export async function GET() {
  if (!preferencesState) {
    preferencesState = buildDefaultPreferences();
  }
  return NextResponse.json({ data: { preferences: preferencesState } });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as UpdatePreferencesRequest;
  if (!preferencesState) {
    preferencesState = buildDefaultPreferences();
  }
  preferencesState = {
    ...preferencesState,
    ...body,
    updated_at: new Date().toISOString(),
  };
  return NextResponse.json({ data: { preferences: preferencesState } });
}

