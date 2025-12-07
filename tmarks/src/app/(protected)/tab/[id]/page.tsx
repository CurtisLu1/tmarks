import TabGroupDetailClient from './TabGroupDetailClient'

export const dynamic = 'force-static'
export const dynamicParams = false

export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

export default async function TabGroupDetailPage({ params }: { params: Promise<{ id: string | string[] }> }) {
  const resolved = await params
  const raw = resolved?.id
  const tabGroupId = Array.isArray(raw) ? raw[0] ?? null : raw ?? null

  return <TabGroupDetailClient tabGroupId={tabGroupId} />
}
