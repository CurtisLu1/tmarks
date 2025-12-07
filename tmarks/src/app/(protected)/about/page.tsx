import { Github, Globe, Heart, Shield, Star, Zap } from 'lucide-react';

export default function AboutPage() {
  const frontendStack = ['Next.js 15', 'React 19', 'TypeScript', 'App Router', 'TailwindCSS', 'shadcn/ui', 'Zustand', 'React Query'];
  const backendStack = ['Cloudflare Pages', 'Cloudflare D1', 'Cloudflare KV', 'JWT'];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">关于 TMarks</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          现代化的智能书签管理系统，基于 Next.js App Router 与 shadcn/ui 打造
        </p>
      </div>

      <div className="card p-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
          <Star className="w-4 h-4" />
          <span className="text-sm font-medium">Migration Ready</span>
        </div>
        <p className="text-sm text-muted-foreground">采用 Next.js 15.5.7 与 React 19.0.1，修复已知 RSC 漏洞</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">核心特性</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">快速高效</h3>
            </div>
            <p className="text-sm text-muted-foreground">基于 Cloudflare 全球网络与静态导出优化，提供极速体验</p>
          </div>

          <div className="card p-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-success" />
              </div>
              <h3 className="font-semibold text-foreground">安全可靠</h3>
            </div>
            <p className="text-sm text-muted-foreground">采用修复 CVE-2025-55182 与 CVE-2025-66478 的版本，数据加密存储</p>
          </div>

          <div className="card p-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-warning" />
              </div>
              <h3 className="font-semibold text-foreground">多端同步</h3>
            </div>
            <p className="text-sm text-muted-foreground">浏览器扩展 + Web 应用，无缝同步书签与标签页组</p>
          </div>

          <div className="card p-5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-error" />
              </div>
              <h3 className="font-semibold text-foreground">开源免费</h3>
            </div>
            <p className="text-sm text-muted-foreground">MIT 许可证，欢迎贡献代码与反馈</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">技术栈</h2>
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">前端</h3>
            <div className="flex flex-wrap gap-2">
              {frontendStack.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">后端</h3>
            <div className="flex flex-wrap gap-2">
              {backendStack.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Github className="w-6 h-6 text-foreground" />
          <h2 className="text-xl font-bold text-foreground">开源项目</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          TMarks 采用 MIT 许可证，欢迎提交 Bug、改进文档或贡献功能。
        </p>
        <a
          href="https://github.com/your-username/tmarks"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Github className="w-4 h-4" />
          访问 GitHub 仓库
        </a>
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="text-xl font-bold text-foreground">致谢</h2>
        <p className="text-sm text-muted-foreground">
          感谢所有贡献者，以及以下优秀的开源项目和服务：
        </p>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>• Cloudflare Pages & D1</div>
          <div>• Next.js & React</div>
          <div>• TailwindCSS & shadcn/ui</div>
          <div>• Lucide Icons</div>
        </div>
      </div>
    </div>
  );
}

