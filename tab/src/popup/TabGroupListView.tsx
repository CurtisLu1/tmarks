import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { createTMarksClient } from '@/lib/api/tmarks';
import type { BookmarkSiteConfig } from '@/types';
import type { TMarksTabGroup } from '@/lib/api/tmarks/tab-groups';
import { normalizeApiUrl } from '@/lib/constants/urls';

interface TabGroupListViewProps {
    config: BookmarkSiteConfig;
    onBack: () => void;
}

export function TabGroupListView({ config, onBack }: TabGroupListViewProps) {
    const [groups, setGroups] = useState<TMarksTabGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setIsLoading(true);
            const client = createTMarksClient({
                baseUrl: normalizeApiUrl(config.apiUrl),
                apiKey: config.apiKey,
            });

            const allGroups = await client.tabGroups.getAllTabGroups();
            // Filter out deleted groups if any (though API usually handles this)
            // and maybe sort by updated_at desc
            const sortedGroups = allGroups.sort((a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );

            setGroups(sortedGroups);
        } catch (err) {
            console.error('Failed to load tab groups:', err);
            setError('加载分组列表失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (group: TMarksTabGroup) => {
        if (!group.items || group.items.length === 0) {
            alert('该分组为空，无法恢复');
            return;
        }

        try {
            setIsRestoring(group.id);

            // Use chrome.windows.create directly as restoreTabGroup service currently relies on local DB IDs
            // but here we have remote data.
            const urls = group.items
                .sort((a, b) => a.position - b.position)
                .map(item => item.url);

            await chrome.windows.create({
                url: urls,
                focused: true,
            });

            // Optional: Close popup after restore?
            // window.close(); 
        } catch (err) {
            console.error('Failed to restore group:', err);
            alert('恢复分组失败');
        } finally {
            setIsRestoring(null);
        }
    };

    return (
        <div className="relative h-[80vh] min-h-[620px] w-[380px] overflow-hidden rounded-b-2xl bg-white text-gray-900 shadow-2xl">
            <div className="relative flex h-full flex-col">
                {/* Error Message */}
                {error && (
                    <div className="absolute top-4 left-0 right-0 z-[9999] px-4 pointer-events-none">
                        <div className="pointer-events-auto">
                            <ErrorMessage message={error} onDismiss={() => setError(null)} />
                        </div>
                    </div>
                )}

                {/* Header */}
                <header className="fixed top-0 left-0 right-0 z-40 px-3 pt-2 pb-2.5 bg-white border-b border-gray-200 shadow-sm rounded-b-2xl">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onBack}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-all duration-200 hover:bg-gray-100 active:scale-95"
                            title="返回"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="font-semibold text-sm text-gray-800">
                            云端资源库
                        </span>
                        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] text-blue-600 font-medium">
                            {groups.length} 个分组
                        </span>
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="relative flex-1 space-y-3 overflow-y-auto px-4 pb-5 pt-[60px] bg-white">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                            <LoadingSpinner />
                            <p className="text-sm">正在同步云端数据...</p>
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-16 w-16 mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                                <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-gray-900">暂无分组</p>
                            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                                在“标签收纳”模式中保存的分组会显示在这里
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {groups.map((group) => {
                                const itemCount = group.items?.length || group.item_count || 0;

                                return (
                                    <div
                                        key={group.id}
                                        className="group relative rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                                                        {group.title}
                                                    </h3>
                                                    {group.id === isRestoring && (
                                                        <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                        </svg>
                                                        {itemCount} 个页面
                                                    </span>
                                                    <span>
                                                        {new Date(group.updated_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleRestore(group)}
                                                disabled={!!isRestoring || itemCount === 0}
                                                className="flex-shrink-0 flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                打开
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
