import { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  icon: ReactNode
}

interface SettingsTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  children: ReactNode
}

export function SettingsTabs({ tabs, activeTab, onTabChange, children }: SettingsTabsProps) {
  return (
    <div className="space-y-6">
      {/* 标签页导航 */}
      <div className="border-b border-border overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 标签页内容 */}
      <div className="animate-in fade-in duration-200">
        {children}
      </div>
    </div>
  )
}
