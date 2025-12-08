export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(parsed.protocol) && Boolean(parsed.host);
  } catch {
    return false;
  }
}

export function sanitizeString(value: string, maxLength = 1000): string {
  return value.trim().slice(0, maxLength);
}


