export function generateSlug(): string {
  const uuid = crypto.randomUUID().replace(/-/g, '')
  return uuid.slice(0, 10)
}
