import type { PagesFunction } from '@cloudflare/workers-types'

export const onRequestGet: PagesFunction = async () => {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  })
}
