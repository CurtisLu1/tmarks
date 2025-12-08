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
    const [allGroups, setAllGroups] = useState<TMarksTabGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [folderStack, setFolderStack] = useState<{ id: string | null; title: string }[]>([
        { id: null, title: '云端资源库' }
    ]);

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

            const groups = await client.tabGroups.getAllTabGroups();
            setAllGroups(groups);
        } catch (err) {
            console.error('Failed to load tab groups:', err);
            setError('加载分组列表失败');
        } finally {
            setIsLoading(false);
        }
    };

    // Get items to display in current folder
    const currentItems = allGroups
        .filter(g => g.parent_id === currentFolderId)
        .sort((a, b) => {
            // Folders first, then by updated_at desc
            if (a.is_folder && !b.is_folder) return -1;
            if (!a.is_folder && b.is_folder) return 1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

    const handleFolderClick = (folder: TMarksTabGroup) => {
        setFolderStack(prev => [...prev, { id: folder.id, title: folder.title }]);
        setCurrentFolderId(folder.id);
    };

    const handleBackToFolder = (index: number) => {
        const newStack = folderStack.slice(0, index + 1);
        setFolderStack(newStack);
        setCurrentFolderId(newStack[newStack.length - 1].id);
    };

    const handleRestore = async (group: TMarksTabGroup) => {
        if (!group.items || group.items.length === 0) {
            alert('该分组为空，无法恢复');
            return;
        }

        try {
            setIsRestoring(group.id);

            const urls = group.items
                .sort((a, b) => a.position - b.position)
                .map(item => item.url);

            await chrome.windows.create({
                url: urls,
                focused: true,
            });
        } catch (err) {
            console.error('Failed to restore group:', err);
            alert('恢复分组失败');
        } finally {
            setIsRestoring(null);
        }
    };

    const canGoBack = folderStack.length > 1;

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
                            onClick={canGoBack ? () => handleBackToFolder(folderStack.length - 2) : onBack}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-all duration-200 hover:bg-gray-100 active:scale-95"
                            title={canGoBack ? "返回上层" : "返回"}
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex-1 min-w-0">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-1 text-sm">
                                {folderStack.map((item, index) => (
                                    <span key={index} className="flex items-center gap-1">
                                        {index > 0 && <span className="text-gray-400">/</span>}
                                        <button
                                            onClick={() => handleBackToFolder(index)}
                                            className={`truncate max-w-[100px] ${index === folderStack.length - 1
                                                ? 'font-semibold text-gray-800'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            {item.title}
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] text-blue-600 font-medium">
                            {currentItems.length} 项
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
                    ) : currentItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-16 w-16 mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
                                <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                                {currentFolderId ? '文件夹为空' : '暂无分组'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                                {currentFolderId
                                    ? '此文件夹内没有标签页组'
                                    : '在"标签收纳"模式中保存的分组会显示在这里'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {currentItems.map((group) => {
                                const itemCount = group.items?.length || group.item_count || 0;
                                const isFolder = group.is_folder;

                                if (isFolder) {
                                    // Folder item - click to enter
                                    const childCount = allGroups.filter(g => g.parent_id === group.id).length;
                                    return (
                                        <div
                                            key={group.id}
                                            onClick={() => handleFolderClick(group)}
                                            className="group relative rounded-2xl border border-gray-200 bg-gray-50 p-3 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                                                        {group.title}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">
                                                        {childCount} 个项目
                                                    </p>
                                                </div>
                                                <svg className="h-4 w-4 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                }

                                // Tab group item - click to restore
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
