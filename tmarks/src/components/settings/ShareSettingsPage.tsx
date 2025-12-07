'use client';

import { useEffect, useMemo, useState } from 'react';

import { useShareSettings, useUpdateShareSettings } from '@/hooks/useShare';

export function ShareSettingsPage() {
  const { data, isLoading } = useShareSettings();
  const updateShare = useUpdateShareSettings();

  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setSlug(data.slug || '');
    setTitle(data.title || '');
    setDescription(data.description || '');
  }, [data]);

  const shareUrl = useMemo(() => {
    if (!slug) return '';
    if (typeof window === 'undefined') return `/share/${slug}`;
    return `${window.location.origin}/share/${slug}`;
  }, [slug]);

  const handleSave = () => {
    updateShare.mutate({
      enabled,
      slug: slug.trim() || null,
      title: title.trim() || null,
      description: description.trim() || null,
    });
  };

  const handleRegenerate = () => {
    updateShare.mutate({
      regenerate_slug: true,
      enabled: true,
      title: title.trim() || null,
      description: description.trim() || null,
    });
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Copy failed', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">公开分享设置</h1>

      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">启用公开分享</h2>
            <p className="text-sm text-base-content/70">开启后可将书签以只读页面公开给任何人访问。</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <span>开启公开分享</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isLoading || updateShare.isPending}
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-base-content/70">分享链接后缀</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="例如：my-bookmarks"
                value={slug}
                onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
                disabled={isLoading || updateShare.isPending}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleRegenerate}
                disabled={updateShare.isPending}
              >
                重新生成
              </button>
            </div>
            <p className="text-xs text-base-content/60">仅支持字母、数字与短横线，留空将自动生成。</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-base-content/70">页面标题</label>
            <input
              type="text"
              className="input"
              placeholder="公开页面标题，用于向访客介绍"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading || updateShare.isPending}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-base-content/70">页面描述</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="可选描述，向访客说明书签集合内容"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading || updateShare.isPending}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-base-content/70">分享链接</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              readOnly
              value={shareUrl || '生成后显示分享链接'}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleCopy}
              disabled={!shareUrl}
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => {
              if (!data) return;
              setEnabled(data.enabled);
              setSlug(data.slug || '');
              setTitle(data.title || '');
              setDescription(data.description || '');
            }}
            disabled={isLoading || updateShare.isPending}
          >
            重置
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleSave}
            disabled={updateShare.isPending}
          >
            {updateShare.isPending ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

