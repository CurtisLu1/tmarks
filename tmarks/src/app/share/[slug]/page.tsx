import SharePageClient from './SharePageClient'

export const dynamic = 'force-static'
export const dynamicParams = false

export async function generateStaticParams() {
  return [{ slug: 'placeholder' }]
}

export default async function PublicSharePage({ params }: { params: Promise<{ slug: string | string[] }> }) {
  const resolved = await params
  const raw = resolved?.slug
  const slugValue = Array.isArray(raw) ? raw[0] ?? null : raw ?? null
  const slug = slugValue === 'placeholder' ? null : slugValue

  return <SharePageClient slug={slug} />
}
