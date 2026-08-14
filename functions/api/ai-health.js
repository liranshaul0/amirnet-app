// Cloudflare Pages Function — GET /api/ai-health
// Self-contained on purpose: no imports, no newer-runtime APIs. A module-level
// failure here would take the whole site down with a 1101, so it stays trivial.

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function onRequestGet(context) {
  var env = (context && context.env) || {};
  var gemini = Boolean(env.GEMINI_API_KEY);
  var workersAi = Boolean(env.AI);
  return json({
    ok: true,
    configured: gemini || workersAi,
    provider: gemini ? 'gemini' : workersAi ? 'workers-ai' : 'none',
    providers: { gemini: gemini, workersAi: workersAi },
  });
}
