export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isValidUsername(username: string): boolean {
  // 3-20 个字符，字母、数字、下划线
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

export function isValidPassword(password: string): boolean {
  // 至少 8 个字符
  return password.length >= 8
}

export function sanitizeString(str: string, maxLength = 1000): string {
  return str.trim().slice(0, maxLength)
}
