/**
 * 创建 API Key 模态框
 * 多步骤流程：基本信息 → 权限设置 → 过期设置 → 显示 Key
 */

import { useState } from 'react'
import { useCreateApiKey } from '@/hooks/useApiKeys'
import {
  PERMISSION_TEMPLATES,
  getPermissionLabel,
  type PermissionTemplate,
} from '@shared/permissions'
import type { ApiKeyWithKey, CreateApiKeyRequest } from '@/services/api-keys'

interface CreateApiKeyModalProps {
  onClose: () => void
}

type Step = 'basic' | 'permissions' | 'expiration' | 'success'

export function CreateApiKeyModal({ onClose }: CreateApiKeyModalProps) {
  const createApiKey = useCreateApiKey()

  const [step, setStep] = useState<Step>('basic')
  const [formData, setFormData] = useState<CreateApiKeyRequest>({
    name: '',
    description: '',
    template: 'BASIC',
    permissions: [],
    expires_at: null,
  })
  const [createdKey, setCreatedKey] = useState<ApiKeyWithKey | null>(null)
  const [copied, setCopied] = useState(false)

  const handleNext = () => {
    if (step === 'basic') setStep('permissions')
    else if (step === 'permissions') setStep('expiration')
    else if (step === 'expiration') handleCreate()
  }

  const handleBack = () => {
    if (step === 'permissions') setStep('basic')
    else if (step === 'expiration') setStep('permissions')
  }

  const handleCreate = async () => {
    try {
      const result = await createApiKey.mutateAsync(formData)
      setCreatedKey(result)
      setStep('success')
    } catch {
      alert('创建失败，请重试')
    }
  }

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const canProceed = () => {
    if (step === 'basic') return formData.name.trim().length > 0
    if (step === 'permissions') {
      const perms =
        formData.template
          ? PERMISSION_TEMPLATES[formData.template].permissions
          : formData.permissions
      return perms && perms.length > 0
    }
    return true
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center" style={{ zIndex: 200 }}>
      <div className="card rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 步骤 1: 基本信息 */}
        {step === 'basic' && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              创建 API Key - 步骤 1/3
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  名称 *
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="例如：Chrome 插件 - 工作电脑"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  用于识别此 Key 的用途
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  描述 (可选)
                </label>
                <textarea
                  className="input w-full h-20 resize-none"
                  placeholder="例如：用于浏览器插件访问"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button className="btn" onClick={onClose}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* 步骤 2: 权限设置 */}
        {step === 'permissions' && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              创建 API Key - 步骤 2/3
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  快速选择:
                </label>
                <div className="space-y-2">
                  {(Object.keys(PERMISSION_TEMPLATES) as PermissionTemplate[]).map(
                    (template) => (
                      <label
                        key={template}
                        className="flex items-start gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30"
                      >
                        <input
                          type="radio"
                          name="template"
                          checked={formData.template === template}
                          onChange={() =>
                            setFormData({ ...formData, template })
                          }
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {PERMISSION_TEMPLATES[template].name}
                            {template === 'BASIC' && (
                              <span className="ml-2 text-xs bg-primary text-primary-content px-2 py-0.5 rounded">
                                推荐
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {PERMISSION_TEMPLATES[template].description}
                          </div>
                        </div>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* 预览权限 */}
              <div className="p-4 bg-muted/30 border border-border rounded-lg">
                <div className="text-sm font-medium text-foreground mb-2">
                  包含的权限:
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {(formData.template
                    ? PERMISSION_TEMPLATES[formData.template].permissions
                    : formData.permissions || []
                  ).map((perm: string) => (
                    <div key={perm} className="flex items-center gap-2">
                      <span>✓</span>
                      <span className="font-medium">{getPermissionLabel(perm)}</span>
                      <span className="text-muted-foreground/60">({perm})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button className="btn" onClick={handleBack}>
                ← 上一步
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* 步骤 3: 过期设置 */}
        {step === 'expiration' && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              创建 API Key - 步骤 3/3
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  过期时间:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30">
                    <input
                      type="radio"
                      name="expires"
                      checked={formData.expires_at === null}
                      onChange={() =>
                        setFormData({ ...formData, expires_at: null })
                      }
                    />
                    <span className="text-foreground">永不过期</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30">
                    <input
                      type="radio"
                      name="expires"
                      checked={formData.expires_at === '30d'}
                      onChange={() =>
                        setFormData({ ...formData, expires_at: '30d' })
                      }
                    />
                    <span className="text-foreground">30 天后</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/30">
                    <input
                      type="radio"
                      name="expires"
                      checked={formData.expires_at === '90d'}
                      onChange={() =>
                        setFormData({ ...formData, expires_at: '90d' })
                      }
                    />
                    <span className="text-foreground">90 天后</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button className="btn" onClick={handleBack}>
                ← 上一步
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={createApiKey.isPending}
              >
                {createApiKey.isPending ? '创建中...' : '创建 API Key'}
              </button>
            </div>
          </div>
        )}

        {/* 步骤 4: 成功显示 Key */}
        {step === 'success' && createdKey && (
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                创建成功！请妥善保存此 Key
              </h2>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                您的 API Key:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1 font-mono text-sm"
                  value={createdKey.key}
                  readOnly
                  onClick={(e) => e.currentTarget.select()}
                />
                <button className="btn" onClick={handleCopy}>
                  {copied ? '✓ 已复制' : '📋 复制'}
                </button>
              </div>
            </div>

            <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg mb-6">
              <h4 className="font-medium text-warning mb-2">⚠️ 重要提示：</h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>此 Key 仅显示一次，关闭后无法再查看</li>
                <li>请立即复制并保存到安全的地方</li>
                <li>后续您只能看到前缀: {createdKey.key_prefix}...</li>
              </ul>
            </div>

            <div className="flex justify-center">
              <button className="btn btn-primary" onClick={onClose}>
                我已保存，关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
