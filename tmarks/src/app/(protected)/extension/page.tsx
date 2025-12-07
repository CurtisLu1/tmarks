'use client';

import { AlertCircle, CheckCircle, Chrome, Download } from 'lucide-react';

function handleDownload(browser: string) {
  const link = document.createElement('a');
  link.href = `/extensions/tmarks-extension-${browser}.zip`;
  link.download = `tmarks-extension-${browser}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const browsers: Array<{ id: string; label: string }> = [
  { id: 'chrome', label: 'Chrome' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'edge', label: 'Edge' },
  { id: 'opera', label: 'Opera' },
  { id: 'brave', label: 'Brave' },
  { id: '360', label: '360' },
  { id: 'qq', label: 'QQ' },
  { id: 'sogou', label: '搜狗' },
];

const steps = [
  { title: '下载插件压缩包', content: '点击对应浏览器的下载按钮获取 zip 文件。' },
  { title: '解压文件', content: '将下载的 zip 文件解压到不会删除的位置。' },
  { title: '打开扩展管理页面', content: '在浏览器地址栏输入 chrome://extensions/ 或 edge://extensions/ 等。' },
  { title: '启用开发者模式', content: '在扩展管理页面打开“开发者模式”。' },
  { title: '加载插件', content: '点击“加载已解压的扩展程序”，选择刚才解压的文件夹。' },
  { title: '完成安装', content: '插件图标出现在浏览器工具栏，点击即可使用。' },
];

export default function ExtensionPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-float">
          <Chrome className="w-12 h-12" style={{ color: 'var(--foreground)' }} />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
          TMarks 浏览器插件
        </h1>
        <p className="text-lg" style={{ color: 'var(--muted-foreground)' }}>
          一键保存标签页组，让书签管理更高效
        </p>
      </div>

      <div className="card shadow-float mb-8 bg-gradient-to-br from-primary/5 to-secondary/5">
        <h2 className="text-xl font-bold mb-4 text-center" style={{ color: 'var(--foreground)' }}>
          选择你的浏览器下载
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {browsers.map((browser) => (
            <div
              key={browser.id}
              className="text-center p-3 rounded-xl border-2 transition-all hover:border-primary"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="w-10 h-10 mx-auto mb-2 flex items-center justify-center">
                <Chrome className="w-10 h-10" style={{ color: 'var(--foreground)' }} />
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                {browser.label}
              </h3>
              <button
                onClick={() => handleDownload(browser.id)}
                className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:shadow-md transition-all hover:scale-105 active:scale-95"
              >
                <Download className="w-3 h-3" />
                下载
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--foreground)' }}>
            支持的浏览器
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">Chrome</div>
              <div className="text-xs opacity-75">88+</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">Edge</div>
              <div className="text-xs opacity-75">88+</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">Firefox</div>
              <div className="text-xs opacity-75">109+</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">Brave</div>
              <div className="text-xs opacity-75">88+</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">Opera</div>
              <div className="text-xs opacity-75">74+</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">360浏览器</div>
              <div className="text-xs opacity-75">极速模式</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">QQ浏览器</div>
              <div className="text-xs opacity-75">极速模式</div>
            </div>
            <div className="text-center p-2 rounded bg-muted/30">
              <div className="font-medium">搜狗浏览器</div>
              <div className="text-xs opacity-75">极速模式</div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            版本：1.0.0 | 大小：约 258 KB | 更新时间：2024-11-19
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
            💡 提供 8 个浏览器专用版本，也可以使用 Chrome 通用版（支持所有基于 Chrome 的浏览器）
          </p>
        </div>
      </div>

      <div className="card shadow-float mb-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
          ✨ 主要功能
        </h2>
        <div className="space-y-3">
          <Feature title="一键保存标签页组" description="将当前浏览器打开的所有标签页一键保存到 TMarks，包括标题、URL 和网站图标" />
          <Feature title="快速恢复标签页" description="从 TMarks 网站一键恢复之前保存的标签页组，继续之前的工作" />
          <Feature title="自动同步" description="标签页组自动同步到云端，多设备无缝切换" />
        </div>
      </div>

      <div className="card shadow-float mb-8">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
          📦 安装步骤
        </h2>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{index + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {step.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {step.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card shadow-float bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
          <div>
            <h3 className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              💡 使用提示
            </h3>
            <ul className="text-sm space-y-1" style={{ color: 'var(--muted-foreground)' }}>
              <li>• 首次使用需要在插件中配置 TMarks 网站地址和 API Key</li>
              <li>• API Key 可以在网站的“API Keys”页面创建</li>
              <li>• 建议将插件图标固定到工具栏，方便快速访问</li>
              <li>• 插件会自动保存标签页的标题、URL 和网站图标</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card shadow-float">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
          ❓ 常见问题
        </h2>
        <div className="space-y-4">
          <FAQ question="插件安装后找不到图标？" answer="点击浏览器工具栏右侧的拼图图标，找到 TMarks 插件并点击固定按钮。" />
          <FAQ question="如何获取 API Key？" answer="在网站“API Keys”页面创建新的 API Key，并复制到插件配置中。" />
          <FAQ question="插件支持哪些浏览器？" answer="支持 Chrome、Edge、Firefox、Brave、Opera 等主流浏览器，Chrome 版本可用于大多数 Chromium 浏览器。" />
          <FAQ question="保存的标签页组在哪里查看？" answer="在 TMarks 网站的“标签页”页面可以查看和管理所有保存的标签页组。" />
        </div>
      </div>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-success" />
      <div>
        <h3 className="font-medium" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      </div>
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>
        Q: {question}
      </h3>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        A: {answer}
      </p>
    </div>
  );
}

