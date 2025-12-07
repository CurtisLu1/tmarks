'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Tag, Globe, Clock, Bookmark, ArrowLeft, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

import { MobileHeader } from '@/components/common/MobileHeader';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { logger } from '@/lib/logger';
import { bookmarksService } from '@/services/bookmarks';

interface BookmarkStatistics {
  summary: {
    total_bookmarks: number;
    total_tags: number;
    total_clicks: number;
    archived_bookmarks: number;
    public_bookmarks: number;
  };
  top_bookmarks: Array<{
    id: string;
    title: string;
    url: string;
    click_count: number;
    last_clicked_at: string | null;
  }>;
  top_tags: Array<{
    id: string;
    name: string;
    color: string | null;
    click_count: number;
    bookmark_count: number;
  }>;
  top_domains: Array<{
    domain: string;
    count: number;
  }>;
  bookmark_clicks: Array<{
    id: string;
    title: string;
    url: string;
    click_count: number;
    last_clicked_at?: string | null;
  }>;
  recent_clicks: Array<{
    id: string;
    title: string;
    url: string;
    last_clicked_at: string;
  }>;
  trends: {
    bookmarks: Array<{ date: string; count: number }>;
    clicks: Array<{ date: string; count: number }>;
  };
}

type Granularity = 'day' | 'week' | 'month' | 'year';

interface BookmarkStatisticsPageProps {
  embedded?: boolean;
}

export function BookmarkStatisticsPage({ embedded = false }: BookmarkStatisticsPageProps) {
  const isMobile = useIsMobile();
  const [statistics, setStatistics] = useState<BookmarkStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [granularity, setGranularity] = useState<Granularity>('day');
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    switch (granularity) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week': {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return {
      startDate: start.toISOString().split('T')[0] as string,
      endDate: end.toISOString().split('T')[0] as string,
    };
  }, [currentDate, granularity]);

  const loadStatistics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const range = getDateRange();
      const data = await bookmarksService.getStatistics({
        granularity,
        startDate: range.startDate,
        endDate: range.endDate,
      }) as BookmarkStatistics;
      setStatistics(data);
    } catch (err) {
      logger.error('Failed to load bookmark statistics:', err);
      setError('加载统计数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [granularity, getDateRange]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const navigateTime = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);

    switch (granularity) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
        break;
    }

    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatCurrentRange = () => {
    const range = getDateRange();
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);

    if (granularity === 'day') {
      return start.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (granularity === 'week') {
      return `${start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}`;
    }
    if (granularity === 'month') {
      return start.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
    }
    return `${start.getFullYear()} 年`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    if (granularity === 'year') {
      return `${dateString} 年`;
    }
    if (granularity === 'month') {
      const [year, month] = dateString.split('-');
      if (!year || !month) return dateString;
      const monthNum = Number.parseInt(month, 10);
      if (!Number.isFinite(monthNum)) return dateString;
      return `${year} 年 ${monthNum} 月`;
    }
    if (granularity === 'week') {
      const [year, week] = dateString.split('-W');
      if (!year || !week) return dateString;
      return `${year} 年 第 ${week} 周`;
    }
    return new Date(dateString).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (isoDate: string | null) => {
    if (!isoDate) return '从未点击';
    const now = new Date();
    const date = new Date(isoDate);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    if (weeks < 4) return `${weeks} 周前`;
    if (months < 12) return `${months} 个月前`;
    return `${years} 年前`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">加载统计数据中...</p>
        </div>
      </div>
    );
  }

  if (error || !statistics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || '加载失败'}</p>
          <button
            onClick={loadStatistics}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            type="button"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-20' : ''}`}>
      {isMobile && (
        <MobileHeader
          title="书签统计"
          showMenu={false}
          showSearch={false}
          showMore={false}
        />
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          {!isMobile && !embedded && (
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回书签</span>
            </Link>
          )}

          <div className="flex items-center justify-between mb-4">
            {!isMobile && !embedded && (
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">书签统计</h1>
              </div>
            )}

            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
            >
              <option value="day">按日</option>
              <option value="week">按周</option>
              <option value="month">按月</option>
              <option value="year">按年</option>
            </select>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <button
              onClick={() => navigateTime('prev')}
              className="btn btn-secondary btn-sm flex items-center gap-1"
              title={`上一${granularity === 'day' ? '天' : granularity === 'week' ? '周' : granularity === 'month' ? '月' : '年'}`}
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">
                {granularity === 'day' ? '上一天' : granularity === 'week' ? '上一周' : granularity === 'month' ? '上一月' : '上一年'}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <div className="text-base sm:text-lg font-semibold text-foreground px-3 sm:px-4 py-2 bg-muted/30 rounded-lg min-w-[200px] sm:min-w-[280px] text-center">
                {formatCurrentRange()}
              </div>
              <button
                onClick={goToToday}
                className="btn btn-ghost btn-sm"
                title="回到今天"
                type="button"
              >
                今天
              </button>
            </div>

            <button
              onClick={() => navigateTime('next')}
              className="btn btn-secondary btn-sm flex items-center gap-1"
              title={`下一${granularity === 'day' ? '天' : granularity === 'week' ? '周' : granularity === 'month' ? '月' : '年'}`}
              type="button"
            >
              <ChevronRight className="w-4 h-4" />
              <span className="hidden sm:inline">
                {granularity === 'day' ? '下一天' : granularity === 'week' ? '下一周' : granularity === 'month' ? '下一月' : '下一年'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总书签</p>
                <p className="text-2xl font-bold text-foreground">{statistics.summary.total_bookmarks}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              公开: {statistics.summary.public_bookmarks} · 归档: {statistics.summary.archived_bookmarks}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-success/10 text-success">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总点击</p>
                <p className="text-2xl font-bold text-foreground">{statistics.summary.total_clicks}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">最近 7 天热度趋势</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">标签总数</p>
                <p className="text-2xl font-bold text-foreground">{statistics.summary.total_tags}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">热门标签与领域分布</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">热门书签</h3>
              </div>
              <span className="text-xs text-muted-foreground">按点击次数降序</span>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {statistics.top_bookmarks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              )}
              {statistics.top_bookmarks.map((bookmark, index) => (
                <div
                  key={bookmark.id}
                  className="p-3 rounded-lg border border-border hover:border-primary/40 transition-colors flex gap-3 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <a
                        href={bookmark.url}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors break-all"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {bookmark.title}
                      </a>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {bookmark.click_count} 次点击
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Globe className="w-3 h-3" />
                      <span className="truncate">{new URL(bookmark.url).hostname}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(bookmark.last_clicked_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">热门标签</h3>
              </div>
              <span className="text-xs text-muted-foreground">按点击与使用次数</span>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {statistics.top_tags.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              )}
              {statistics.top_tags.map((tag) => (
                <div
                  key={tag.id}
                  className="p-3 rounded-lg border border-border hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: tag.color || 'var(--primary)' }}
                      />
                      <p className="text-sm font-medium text-foreground">{tag.name}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {tag.click_count} 次点击
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    应用在 {tag.bookmark_count} 个书签上
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">常访问域名</h3>
            </div>
            <div className="space-y-2">
              {statistics.top_domains.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              )}
              {statistics.top_domains.map((domain) => (
                <div
                  key={domain.domain}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{domain.domain}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{domain.count} 次</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">最近点击</h3>
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {statistics.recent_clicks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
              )}
              {statistics.recent_clicks.map((click) => (
                <div
                  key={click.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <a
                      href={click.url}
                      className="text-sm text-foreground hover:text-primary transition-colors"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {click.title}
                    </a>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(click.last_clicked_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">点击趋势</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">书签数量变化</h4>
              <div className="space-y-2">
                {statistics.trends.bookmarks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
                )}
                {statistics.trends.bookmarks.map((item) => (
                  <div key={item.date} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-muted-foreground">{formatDate(item.date)}</div>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.min(100, (item.count / Math.max(1, statistics.summary.total_bookmarks)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs text-foreground">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">点击次数变化</h4>
              <div className="space-y-2">
                {statistics.trends.clicks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
                )}
                {statistics.trends.clicks.map((item) => (
                  <div key={item.date} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-muted-foreground">{formatDate(item.date)}</div>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-success"
                        style={{
                          width: `${Math.min(100, (item.count / Math.max(1, statistics.summary.total_clicks || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs text-foreground">{item.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">点击明细</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase">
                  <th className="px-3 py-2 text-left">标题</th>
                  <th className="px-3 py-2 text-left">域名</th>
                  <th className="px-3 py-2 text-left">点击次数</th>
                  <th className="px-3 py-2 text-left">最近点击</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statistics.bookmark_clicks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                )}
                {statistics.bookmark_clicks.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2">
                      <a
                        href={item.url}
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.title}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{new URL(item.url).hostname}</td>
                    <td className="px-3 py-2">{item.click_count}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.last_clicked_at ? formatDuration(item.last_clicked_at) : '从未点击'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

