// Cloudflare Pages Function — GET /api/ai-health
// The frontend probes this once at startup to decide whether to show AI buttons.
import { providerStatus } from '../_shared.js';

export function onRequestGet(context) {
  const status = providerStatus(context.env);
  const configured = status.gemini || status.workersAi;
  return Response.json({
    ok: true,
    configured,
    provider: status.gemini ? 'gemini' : status.workersAi ? 'workers-ai' : 'none',
    providers: status,
  });
}
