interface SettingsTipsProps {
  tips: string[]
}

export function SettingsTips({ tips }: SettingsTipsProps) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-foreground mb-2">
        💡 使用提示
      </h4>
      <ul className="text-xs text-muted-foreground space-y-1">
        {tips.map((tip, index) => (
          <li key={index}>• {tip}</li>
        ))}
      </ul>
    </div>
  )
}
