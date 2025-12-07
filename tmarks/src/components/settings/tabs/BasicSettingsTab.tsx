import { useState } from 'react'
import { User, Mail, Calendar, Shield, Lock, Eye, EyeOff, Info } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { InfoBox } from '../InfoBox'
import { apiClient } from '@/lib/api-client'

export function BasicSettingsTab() {
    const { user } = useAuthStore()
    const { addToast } = useToastStore()
    
    const [showPasswordForm, setShowPasswordForm] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isChangingPassword, setIsChangingPassword] = useState(false)

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            addToast('error', '请填写所有字段')
            return
        }

        if (newPassword !== confirmPassword) {
            addToast('error', '两次输入的新密码不一致')
            return
        }

        if (newPassword.length < 6) {
            addToast('error', '新密码至少需要 6 个字符')
            return
        }

        setIsChangingPassword(true)
        try {
            await apiClient.post('/v1/change-password', {
                current_password: currentPassword,
                new_password: newPassword,
            })
            
            addToast('success', '密码修改成功')
            setShowPasswordForm(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (error) {
            const message = error instanceof Error ? error.message : '密码修改失败'
            addToast('error', message)
        } finally {
            setIsChangingPassword(false)
        }
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return '未知'
        try {
            return new Date(dateString).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        } catch {
            return dateString
        }
    }

    return (
        <div className="space-y-6">
            {/* 账户信息 */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">账户信息</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        查看您的账户基本信息
                    </p>
                </div>
                
                <div className="space-y-3">
                    {/* 用户名 */}
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">用户名</div>
                            <div className="text-sm font-medium text-foreground truncate">{user?.username || '未设置'}</div>
                        </div>
                    </div>

                    {/* 邮箱 */}
                    {user?.email && (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Mail className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted-foreground">邮箱</div>
                                <div className="text-sm font-medium text-foreground truncate">{user.email}</div>
                            </div>
                        </div>
                    )}

                    {/* 注册时间 */}
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">注册时间</div>
                            <div className="text-sm font-medium text-foreground">{formatDate(user?.created_at)}</div>
                        </div>
                    </div>

                    {/* 账户角色 */}
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground">账户角色</div>
                            <div className="text-sm font-medium text-foreground">
                                {user?.role === 'admin' ? '管理员' : '普通用户'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-border"></div>

            {/* 修改密码 */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">安全设置</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        修改您的登录密码
                    </p>
                </div>

                {!showPasswordForm ? (
                    <button
                        onClick={() => setShowPasswordForm(true)}
                        className="btn btn-secondary flex items-center gap-2"
                    >
                        <Lock className="w-4 h-4" />
                        修改密码
                    </button>
                ) : (
                    <form onSubmit={handleChangePassword} className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                        {/* 当前密码 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">当前密码</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="input w-full pr-10"
                                    placeholder="请输入当前密码"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* 新密码 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">新密码</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="input w-full pr-10"
                                    placeholder="请输入新密码（至少 6 个字符）"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* 确认新密码 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">确认新密码</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="input w-full pr-10"
                                    placeholder="请再次输入新密码"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* 按钮组 */}
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordForm(false)
                                    setCurrentPassword('')
                                    setNewPassword('')
                                    setConfirmPassword('')
                                }}
                                className="btn btn-ghost flex-1"
                                disabled={isChangingPassword}
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary flex-1"
                                disabled={isChangingPassword}
                            >
                                {isChangingPassword ? '修改中...' : '确认修改'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="border-t border-border"></div>

            {/* 提示信息 */}
            <InfoBox icon={Info} title="账户安全提示" variant="info">
                <ul className="space-y-1 text-sm">
                    <li>• 请定期修改密码以保护账户安全</li>
                    <li>• 密码至少需要 6 个字符</li>
                    <li>• 建议使用字母、数字和符号的组合</li>
                    <li>• 不要与他人分享您的密码</li>
                </ul>
            </InfoBox>
        </div>
    )
}
