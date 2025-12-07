interface SearchAutoClearSettingsProps {
  enabled: boolean
  seconds: number
  onEnabledChange: (enabled: boolean) => void
  onSecondsChange: (seconds: number) => void
}

export function SearchAutoClearSettings({
  enabled,
  seconds,
  onEnabledChange,
  onSecondsChange,
}: SearchAutoClearSettingsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">搜索框自动清空</h3>
        <p className="text-sm text-muted-foreground mt-1">
          设置搜索框在无操作后自动清空的时间
        </p>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground">启用搜索框自动清空</span>
        </label>
      </div>

      {enabled && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            自动清空时间（秒）
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={seconds}
              onChange={(e) => onSecondsChange(Number(e.target.value))}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min="5"
              max="60"
              value={seconds}
              onChange={(e) => onSecondsChange(Number(e.target.value))}
              className="w-20 px-3 py-2 border border-border rounded-lg text-sm text-foreground bg-background"
            />
            <span className="text-sm text-muted-foreground">秒</span>
          </div>
          <p className="text-xs text-muted-foreground">
            搜索框在 {seconds} 秒无操作后会自动清空
          </p>
        </div>
      )}
    </div>
  )
}
