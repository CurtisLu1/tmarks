'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, RefreshCw, Upload } from 'lucide-react';

import { ExportSection } from '@/components/import-export/ExportSection';
import { ImportSection } from '@/components/import-export/ImportSection';
import { BOOKMARKS_QUERY_KEY } from '@/hooks/useBookmarks';
import { TAGS_QUERY_KEY } from '@/hooks/useTags';
import type { ExportFormat, ExportOptions, ImportResult } from '@shared/import-export-types';

type TabId = 'export' | 'import';

interface OperationLog {
  type: 'export' | 'import';
  timestamp: string;
  details: string;
}

export default function ImportExportRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('export');
  const [lastOperation, setLastOperation] = useState<OperationLog | null>(null);

  const tabs: Array<{ id: TabId; label: string; icon: typeof Download; description: string }> = [
    { id: 'export', label: '导出数据', icon: Download, description: '将书签数据导出为文件' },
    { id: 'import', label: '导入数据', icon: Upload, description: '从文件导入书签数据' },
  ];

  const handleExportComplete = (format: ExportFormat, options: ExportOptions) => {
    setLastOperation({
      type: 'export',
      timestamp: new Date().toLocaleString(),
      details: `导出为 ${format.toUpperCase()} 格式${options.include_tags ? '，包含标签' : ''}${options.include_metadata ? '，包含元数据' : ''}`,
    });
  };

  const handleImportComplete = (result: ImportResult) => {
    setLastOperation({
      type: 'import',
      timestamp: new Date().toLocaleString(),
      details: `成功导入 ${result.success} 个书签，创建 ${result.created_tags.length} 个标签${result.failed > 0 ? `，${result.failed} 个失败` : ''}`,
    });
    queryClient.invalidateQueries({ queryKey: [BOOKMARKS_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: [TAGS_QUERY_KEY] });
  };

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted touch-manipulation transition-colors"
                title="返回"
                type="button"
              >
                <ArrowLeft className="h-5 w-5 sm:h-5 sm:w-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">数据管理</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  导入和导出您的书签数据
                </p>
              </div>
            </div>

            {lastOperation && (
              <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span>
                  最近操作: {lastOperation.type === 'export' ? '导出' : '导入'}({lastOperation.timestamp})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-2 sm:space-x-6 md:space-x-8 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group inline-flex items-center py-3 sm:py-4 px-3 sm:px-2 md:px-1 border-b-2 font-medium whitespace-nowrap touch-manipulation transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    }`}
                    type="button"
                  >
                    <Icon
                      className={`mr-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${
                        activeTab === tab.id
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                    />
                    <span className="text-sm sm:text-base font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-2 sm:mt-3 md:mt-4 px-1">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {tabs.find((tab) => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>

        <div className="card shadow-float">
          <div className="p-4 sm:p-6">
            {activeTab === 'export' && <ExportSection onExport={handleExportComplete} />}
            {activeTab === 'import' && (
              <ImportSection
                onImport={handleImportComplete}
                onNavigateToBookmarks={() => router.push('/')}
              />
            )}
          </div>
        </div>

        {lastOperation && (
          <div className="mt-6 sm:mt-8 card shadow-float">
            <div className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">
                最近操作
              </h3>
              <div className="flex items-start space-x-3">
                <div
                  className={`flex-shrink-0 w-8 h-8 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                    lastOperation.type === 'export'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-success/10 text-success'
                  }`}
                >
                  {lastOperation.type === 'export' ? (
                    <Download className="h-4 w-4" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                    <span className="font-medium text-foreground text-sm sm:text-base">
                      {lastOperation.type === 'export' ? '数据导出' : '数据导入'}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-0">
                      {lastOperation.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 break-words">
                    {lastOperation.details}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 sm:mt-6 md:mt-8 bg-primary/5 rounded-lg border border-primary/20">
          <div className="p-3 sm:p-4 md:p-6">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-foreground mb-3 sm:mb-4">
              使用说明
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center">
                  <span className="w-2 h-2 bg-primary rounded-full mr-2 flex-shrink-0" />
                  导出功能
                </h4>
                <div className="ml-4 space-y-1.5">
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      支持 JSON 和 HTML 两种格式
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      JSON 格式包含完整数据，适合备份和迁移
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      HTML 格式兼容浏览器，可直接导入其他浏览器
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      可选择包含标签、元数据等信息
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center">
                  <span className="w-2 h-2 bg-success rounded-full mr-2 flex-shrink-0" />
                  导入功能
                </h4>
                <div className="ml-4 space-y-1.5">
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      支持从浏览器导出的 HTML 书签文件
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      支持 JSON 格式的书签数据
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      自动检测和跳过重复书签
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      可将文件夹结构转换为标签
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-success rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      支持批量处理大文件
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center">
                  <span className="w-2 h-2 bg-warning rounded-full mr-2 flex-shrink-0" />
                  注意事项
                </h4>
                <div className="ml-4 space-y-1.5">
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-warning rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      导入前建议先导出当前数据作为备份
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-warning rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      大文件导入可能需要较长时间，请耐心等待
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-warning rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      导入过程中请勿关闭页面
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1 h-1 bg-warning rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      如遇到问题，可查看错误详情进行排查
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

