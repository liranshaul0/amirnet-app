// Cloudflare Pages Function — GET /api/ai-health
// The frontend probes this once at startup to decide whether to show AI buttons.
export function onRequestGet(context) {
  const hasAi = Boolean(context.env && context.env.AI);
  return Response.json({ ok: true, configured: hasAi, provider: 'cloudflare-workers-ai' });
}
