import type { PagesFunction } from '@cloudflare/workers-types'
import { corsHeaders, securityHeaders, requestLogger } from '../middleware/security'

export const onRequest: PagesFunction[] = [
  requestLogger,
  corsHeaders,
  securityHeaders,
]
