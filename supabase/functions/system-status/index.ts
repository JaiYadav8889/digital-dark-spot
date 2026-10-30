// =============================================================================
// system-status — reports which backend capabilities are actually configured.
// The Settings page reads this so the product never claims an integration that
// is not wired up.
// =============================================================================
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
  const geminiModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
  const extractionUrl = Deno.env.get('EXTRACTION_SERVICE_URL') ?? ''
  const extractionSecret = Deno.env.get('EXTRACTION_SHARED_SECRET') ?? ''
  const notes: string[] = []

  let reachable: boolean | null = null
  if (extractionUrl) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(extractionUrl.replace(/\/$/, '') + '/api/extract', {
        method: 'GET',
        signal: controller.signal,
        headers: extractionSecret ? { 'x-dds-secret': extractionSecret } : {},
      })
      clearTimeout(timer)
      reachable = res.ok
      if (!res.ok) notes.push(`Extraction service responded with HTTP ${res.status}.`)
    } catch (error) {
      reachable = false
      notes.push(`Extraction service unreachable: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    notes.push(
      'EXTRACTION_SERVICE_URL is not set. URL extraction falls back to a Deno HTML reader; PDF extraction is unavailable and sources will be marked failed rather than partially processed.',
    )
  }

  if (!geminiKey) {
    notes.push(
      'GEMINI_API_KEY is not set. Analysis runs on the labelled heuristic engine: findings are generated from evidence coverage rules and are explicitly marked as heuristic, not AI conclusions.',
    )
  } else {
    notes.push(`Gemini is configured with model ${geminiModel} and is called only from this Edge Function.`)
  }

  return json({
    gemini_configured: Boolean(geminiKey),
    gemini_model: geminiKey ? geminiModel : null,
    extraction_service_configured: Boolean(extractionUrl),
    extraction_service_reachable: reachable,
    service_role_configured: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    notes,
  })
})
