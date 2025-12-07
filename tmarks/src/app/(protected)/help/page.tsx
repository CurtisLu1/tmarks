import Link from 'next/link';
import type { Route } from 'next';
import type { UrlObject } from 'url';
import { Book, FileText, HelpCircle, MessageCircle } from 'lucide-react';

interface Guide {
  title: string;
  description: string;
  icon: typeof Book;
  link: Route | UrlObject;
}

const guides: Guide[] = [
  {
    title: '快速开始',
    description: '创建第一个书签并熟悉基础操作',
    icon: Book,
    link: '/' as Route,
  },
  {
    title: '浏览器扩展',
    description: '安装和配置扩展，快捷保存标签页组',
    icon: FileText,
    link: '/extension' as Route,
  },
  {
    title: '导入导出',
    description: '迁移或备份书签数据',
    icon: FileText,
    link: '/import-export' as Route,
  },
  {
    title: '公开分享',
    description: '生成公开链接分享你的书签集合',
    icon: FileText,
    link: { pathname: '/share-settings', query: { tab: 'share' } },
  },
];

const faqs = [
  {
    question: '如何创建书签？',
    answer:
      '点击页面右上角的“新增书签”，填写信息后保存即可。也可以使用浏览器扩展一键保存当前标签页。',
  },
  {
    question: '如何使用标签？',
    answer: '在创建或编辑书签时添加标签。点击侧边栏标签可进行筛选。',
  },
  {
    question: '如何导入浏览器书签？',
    answer: '进入“数据管理”页面选择导入数据，上传浏览器导出的 HTML 书签文件即可。',
  },
  {
    question: '如何分享我的书签？',
    answer: '在“公开分享设置”中启用分享，系统会生成公开链接供他人访问。',
  },
  {
    question: '如何获取 API Key？',
    answer: '在“API Keys”页面创建新的 Key，用于扩展或第三方应用。',
  },
  {
    question: '浏览器扩展如何安装？',
    answer: '访问“浏览器插件”页面，选择对应浏览器的安装包并按照说明安装。',
  },
  {
    question: '如何切换主题？',
    answer: '在“通用设置” -> “外观”中选择浅色、深色或跟随系统模式。',
  },
  {
    question: '数据安全吗？',
    answer: '数据存储于自托管的 PostgreSQL 与对象存储（MinIO/S3 兼容），全链路 HTTPS + JWT 认证，保持最新的 React/Next 安全更新。',
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">帮助中心</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          查找常见问题的答案，或浏览使用指南
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">快速指南</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {guides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Link
                key={guide.title}
                href={guide.link}
                className="card p-5 hover:border-primary/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">{guide.title}</h3>
                    <p className="text-sm text-muted-foreground">{guide.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">常见问题</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="card p-5 group">
              <summary className="flex items-start gap-3 cursor-pointer list-none">
                <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground group-open:text-primary transition-colors">
                    {faq.question}
                  </h3>
                </div>
                <svg
                  className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-3 pl-8 text-sm text-muted-foreground">{faq.answer}</div>
            </details>
          ))}
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">需要更多帮助？</h2>
        </div>
        <p className="text-sm text-muted-foreground">没有找到答案？可以通过以下方式联系我们：</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/your-username/tmarks/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary flex items-center gap-2 justify-center"
          >
            <FileText className="w-4 h-4" />
            提交问题
          </a>
          <a href="mailto:support@tmarks.com" className="btn btn-secondary flex items-center gap-2 justify-center">
            <MessageCircle className="w-4 h-4" />
            联系支持
          </a>
        </div>
      </div>
    </div>
  );
}

