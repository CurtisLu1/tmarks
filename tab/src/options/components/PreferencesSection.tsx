interface PreferencesSectionProps {
  formData: {
    defaultVisibility: 'public' | 'private';
  };
  setFormData: (data: any) => void;
}

export function PreferencesSection({ formData, setFormData }: PreferencesSectionProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 dark:border-amber-500/20 bg-white/90 dark:bg-gray-900/90 shadow-sm backdrop-blur transition-shadow hover:shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      <div className="p-6 pt-10 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">偏好设置</h2>
        </div>

        <div className="space-y-6">
          {/* Default Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              默认可见性
            </label>
            <div className="inline-flex rounded-xl border border-gray-200/80 dark:border-gray-700/70 bg-white/60 dark:bg-gray-800/70 p-1 text-sm font-medium text-gray-600 dark:text-gray-300">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, defaultVisibility: 'public' })}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  formData.defaultVisibility === 'public'
                    ? 'bg-blue-600 text-white shadow'
                    : 'hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                公开
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, defaultVisibility: 'private' })}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  formData.defaultVisibility === 'private'
                    ? 'bg-slate-700 text-white shadow'
                    : 'hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                隐私
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              选择保存书签时默认使用的可见性，可在保存前随时切换。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
